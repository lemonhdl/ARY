-- 00_schemas.sql —— 两层 schema 定义
-- core       : 事实源表,权威,不可被派生数据覆盖
-- read_model : 派生读取模型,可整体重算,不是最终事实源
--
-- 设计对齐 todos/04 §5.1。主键统一使用「可读字符串 ID」(见 todos/04 §5.3 / §10.1)。

DROP SCHEMA IF EXISTS read_model CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;

CREATE SCHEMA core;
CREATE SCHEMA read_model;

COMMENT ON SCHEMA core IS '事实源表:权威,不可被派生数据覆盖';
COMMENT ON SCHEMA read_model IS '派生读取模型:可整体重算,不是最终事实源';
