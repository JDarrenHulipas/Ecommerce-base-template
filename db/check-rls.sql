SELECT schemaname, tablename, rowsecurity AS rls_activo
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('productos','categorias','clientes','pedidos',
                    'pedido_items','opciones','contactos','contenido','tiendas')
ORDER BY tablename;