PERMISSION_KEYS = {
    "login",
    "permission",
    "user_manage",
    "product_manage",
    "customer_manage",
    "search_filter",
    "invoice_create",
    "invoice_search",
    "purchase_track",
    "inventory_view",
    "revenue_statistics",
    "top_products",
    "report_export",
    "sales_data_qa",
    "ai_product_advice",
    "ai_log_view",
    "history_view",
}


DEFAULT_ROLE_PERMISSIONS = {
    "admin": {key: True for key in PERMISSION_KEYS},
    "staff": {
        "login": True,
        "customer_manage": True,
        "search_filter": True,
        "invoice_create": True,
        "invoice_search": True,
        "history_view": True,
    },
    "owner": {
        "login": True,
        "user_manage": True,
        "purchase_track": True,
        "inventory_view": True,
        "revenue_statistics": True,
        "top_products": True,
        "report_export": True,
        "sales_data_qa": True,
        "ai_product_advice": True,
        "ai_log_view": True,
        "history_view": True,
    },
    "customer": {
        "login": True,
        "ai_product_advice": True,
    },
}


def default_permission_allowed(role: str, permission_key: str) -> bool:
    return DEFAULT_ROLE_PERMISSIONS.get(role, {}).get(permission_key, False)
