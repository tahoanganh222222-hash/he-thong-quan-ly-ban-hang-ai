from sqlalchemy import text
from sqlalchemy.engine import Engine


UNICODE_COLUMNS = [
    ("Users", "full_name", "NVARCHAR(100)", False),
    ("Categories", "description", "NVARCHAR(255)", True),
    ("Products", "name", "NVARCHAR(150)", False),
    ("Products", "unit", "NVARCHAR(30)", False),
    ("Customers", "name", "NVARCHAR(100)", False),
    ("Customers", "address", "NVARCHAR(255)", True),
    ("Customers", "customer_group", "NVARCHAR(50)", True),
    ("PurchaseReceipts", "supplier_name", "NVARCHAR(150)", True),
    ("AILogs", "input_data", "NVARCHAR(MAX)", True),
    ("AILogs", "output_data", "NVARCHAR(MAX)", True),
]


def migrate_unicode_columns(engine: Engine) -> None:
    """Upgrade text columns created by older versions from VARCHAR to NVARCHAR."""

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                IF COL_LENGTH('dbo.Users', 'phone') IS NULL
                    ALTER TABLE dbo.Users ADD phone NVARCHAR(20) NULL;
                IF COL_LENGTH('dbo.Users', 'email') IS NULL
                    ALTER TABLE dbo.Users ADD email NVARCHAR(100) NULL;
                """
            )
        )

        category_type = connection.execute(
            text(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Categories' AND COLUMN_NAME='name'"
            )
        ).scalar_one_or_none()

        if category_type and category_type.lower() != "nvarchar":
            connection.execute(
                text(
                    """
                    DECLARE @constraint_name sysname;
                    SELECT TOP 1 @constraint_name = kc.name
                    FROM sys.key_constraints AS kc
                    JOIN sys.index_columns AS ic
                      ON ic.object_id = kc.parent_object_id
                     AND ic.index_id = kc.unique_index_id
                    JOIN sys.columns AS col
                      ON col.object_id = ic.object_id
                     AND col.column_id = ic.column_id
                    WHERE kc.parent_object_id = OBJECT_ID('dbo.Categories')
                      AND kc.type = 'UQ'
                      AND col.name = 'name';

                    IF @constraint_name IS NOT NULL
                        EXEC('ALTER TABLE dbo.Categories DROP CONSTRAINT [' + @constraint_name + ']');

                    ALTER TABLE dbo.Categories ALTER COLUMN name NVARCHAR(100) NOT NULL;
                    ALTER TABLE dbo.Categories
                        ADD CONSTRAINT UQ_Categories_name UNIQUE (name);
                    """
                )
            )

        for table, column, sql_type, nullable in UNICODE_COLUMNS:
            data_type = connection.execute(
                text(
                    "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=:table AND COLUMN_NAME=:column"
                ),
                {"table": table, "column": column},
            ).scalar_one_or_none()
            if data_type and data_type.lower() not in {"nvarchar", "ntext"}:
                null_sql = "NULL" if nullable else "NOT NULL"
                connection.execute(
                    text(
                        f"ALTER TABLE dbo.[{table}] ALTER COLUMN [{column}] {sql_type} {null_sql}"
                    )
                )
