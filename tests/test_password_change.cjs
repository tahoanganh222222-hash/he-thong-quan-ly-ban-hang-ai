const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../frontend/js/account.js'), 'utf8');
const handler = source.slice(source.indexOf('    async function handlePasswordSubmit('),
    source.indexOf('    function setupEvents()'));

function harness(fail = false) {
    const calls = [];
    const fields = {
        'account-current-password': { value: 'OldTest123' },
        'account-new-password': { value: 'NewTest123' },
        'account-confirm-password': { value: 'NewTest123' },
        'login-message': {},
    };
    const button = {};
    const form = { reset() { calls.push('reset'); }, querySelector() { return button; } };
    const context = vm.createContext({
        getElement: id => fields[id],
        showMessage: (...args) => calls.push(args),
        updatePasswordStrength() {},
        closeAccountModal() { calls.push('close'); },
        window: {
            salesApi: { account: { async changePassword() {
                if (fail) throw new Error('Mật khẩu hiện tại không đúng');
                return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
            } } },
            clearAuthSession() { calls.push('clear'); },
            async logout() { calls.push('logout'); },
        },
    });
    vm.runInContext(handler, context);
    return { context, fields, calls, button, form };
}

test('successful password change clears the session and prompts login after the async event', async () => {
    const h = harness();
    const event = { preventDefault() {}, currentTarget: h.form, submitter: h.button };
    const pending = h.context.handlePasswordSubmit(event);
    // A real DOM event clears currentTarget once the event listener returns.
    event.currentTarget = null;
    await pending;
    assert.deepEqual(h.calls, ['reset', 'close', 'clear', 'logout']);
    assert.match(h.fields['login-message'].textContent, /đăng nhập lại/);
    assert.equal(h.button.disabled, false);
});

test('rejected password change preserves the session and shows the API error', async () => {
    const h = harness(true);
    await h.context.handlePasswordSubmit({ preventDefault() {}, currentTarget: h.form, submitter: h.button });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][1], 'Mật khẩu hiện tại không đúng');
    assert.equal(h.calls[0][2], 'error');
    assert.equal(h.button.disabled, false);
});
