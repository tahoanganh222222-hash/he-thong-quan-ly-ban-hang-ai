const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness(file, extra = {}) {
    const events = new EventTarget();
    const storage = new Map();
    const timers = [];
    const classes = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    const doc = {
        readyState: 'loading', hidden: false, addEventListener() {},
        querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
        body: { classList: classes, style: { removeProperty() {} } },
    };
    const context = {
        Event, CustomEvent, console: { log() {}, error() {} },
        document: doc, localStorage: {
            getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        addEventListener: events.addEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
        setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
        clearTimeout() {}, ...extra,
    };
    context.sessionStorage = context.localStorage;
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../frontend/js', file), 'utf8'), context);
    return { context, storage, timers, doc, run: code => vm.runInContext(code, context) };
}

test('401 ends each invalid session, including after a later successful login', async () => {
    let logouts = 0;
    const message = {};
    const h = harness('api.js', {
        logout: () => { logouts++; },
        fetch: async () => ({ status: 401, ok: false, json: async () => ({ detail: 'Access revoked' }) }),
    });
    h.doc.getElementById = id => id === 'login-message' ? message : null;
    for (let attempt = 0; attempt < 2; attempt++) {
        h.storage.set('sales_management_access_token', 'token' + attempt);
        h.context.dispatchEvent(new Event('auth:login'));
        await assert.rejects(h.context.apiRequest('/api/auth/session'), /Access revoked/);
        h.timers.at(-1).callback();
        assert.equal(h.context.getAuthAccessToken(), '');
        assert.equal(message.textContent, 'Access revoked');
    }
    assert.equal(logouts, 2);
});

test('late 401 from an old token does not log out a newly signed-in session', async () => {
    let resolve;
    const h = harness('api.js', { fetch: () => new Promise(done => { resolve = done; }) });
    h.storage.set('sales_management_access_token', 'old');
    const request = h.context.apiRequest('/api/auth/session');
    h.storage.set('sales_management_access_token', 'new');
    resolve({ status: 401, ok: false, json: async () => ({ detail: 'Expired' }) });
    await assert.rejects(request);
    assert.equal(h.context.getAuthAccessToken(), 'new');
    assert.equal(h.timers.length, 0);
});

test('permission refresh preserves unsaved drafts and never restores defaults on failure', async () => {
    const h = harness('permissions.js');
    h.run(`currentPermissionUser = { role: 'ADMIN', isActive: true };
        rolePermissions = clonePermissions(defaultRolePermissions);
        permissionDrafts = clonePermissions(rolePermissions);
        permissionDrafts.SALES.product_manage = true;`);
    h.context.salesApi = { permissions: { list: async () => ({ SALES: { product_manage: false } }) } };
    assert.equal(await h.context.loadPermissionsFromAPI(), true);
    assert.equal(h.run('permissionDrafts.SALES.product_manage'), true);
    assert.equal(h.run('rolePermissions.SALES.product_manage'), false);
    h.context.salesApi.permissions.list = async () => { throw new Error('offline'); };
    assert.equal(await h.context.loadPermissionsFromAPI(), false);
    assert.equal(h.run('rolePermissions.SALES.product_manage'), false);
    assert.equal(h.run('permissionDrafts.SALES.product_manage'), true);
});

test('non-admin permissions start denied while loading authoritative access', () => {
    const h = harness('permissions.js');
    assert.equal(h.run('hasPermission("SALES", "history_view")'), false);
    assert.equal(h.run('hasPermission("CUSTOMER", "ai_product_advice")'), false);
    assert.equal(h.run('hasPermission("ADMIN", "permission")'), true);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
function syncHarness() {
    let token = 'session';
    let applyCount = 0;
    let access = { login: true, history_view: true };
    let snapshot = { user: { id: 1, username: 'staff', full_name: 'Staff', role: 'staff', is_active: true }, permissions: access };
    const h = harness('session-sync.js', {
        getAuthAccessToken: () => token,
        getCurrentUser: () => ({ id: 1, username: 'staff', fullName: 'Staff', role: 'staff', isActive: true }),
        hasCurrentUserPermission: key => access[key] === true,
        applyLivePermissions: next => { applyCount++; const changed = JSON.stringify(access) !== JSON.stringify(next); access = next; return changed; },
        apiRequest: async () => snapshot,
    });
    return { ...h, setToken: value => { token = value; }, setSnapshot: value => { snapshot = value; }, count: () => applyCount };
}

test('live sync closes a page immediately when its required access is revoked', async () => {
    const h = syncHarness();
    let active = true;
    let dashboard = 0;
    h.doc.getElementById = id => id === 'history-page' ? {
        classList: { contains: () => active, remove: () => { active = false; } }
    } : null;
    h.context.showDashboardPage = () => { dashboard++; };
    h.context.dispatchEvent(new Event('focus'));
    await settle();
    h.setSnapshot({ user: { id: 1, username: 'staff', full_name: 'Staff', role: 'staff', is_active: true }, permissions: { login: true, history_view: false } });
    // A remote browser has no BroadcastChannel signal; the next poll must suffice.
    h.timers.at(-1).callback();
    await settle();
    assert.equal(active, false);
    assert.equal(dashboard, 1);
    assert.equal(h.timers.at(-1).delay, 2000);
});

test('late session snapshots are discarded after the token changes', async () => {
    const h = syncHarness();
    let resolve;
    h.context.apiRequest = () => new Promise(done => { resolve = done; });
    h.context.dispatchEvent(new Event('focus'));
    h.setToken('new-session');
    resolve({ user: { role: 'admin' }, permissions: {} });
    await settle();
    assert.equal(h.count(), 0);
});

test('network failure backs off without replacing permissions or ending the session', async () => {
    const h = syncHarness();
    h.context.apiRequest = async () => { throw new Error('offline'); };
    h.context.dispatchEvent(new Event('focus'));
    await settle();
    assert.equal(h.count(), 0);
    assert.equal(h.timers.at(-1).delay, 4000);
    assert.equal(h.context.getAuthAccessToken(), 'session');
});
