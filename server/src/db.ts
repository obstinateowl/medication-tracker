import mysql from "mysql";
import { config } from "./config.js";
import type { ResultSetHeader } from "./dbTypes.js";

type QueryResult<T> = [T, ResultSetHeader | undefined];

function runQuery<T>(
  queryable: mysql.Connection | mysql.Pool,
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return new Promise((resolve, reject) => {
    queryable.query(
      sql,
      params as unknown[] | undefined,
      (err, results) => {
        if (err) {
          reject(err);
          return;
        }
        resolve([results as T, undefined]);
      }
    );
  });
}

function wrapConnection(conn: mysql.PoolConnection) {
  return {
    query: <T>(sql: string, params?: unknown[]) => runQuery<T>(conn, sql, params),
    beginTransaction: () =>
      new Promise<void>((resolve, reject) => {
        conn.beginTransaction((err) => (err ? reject(err) : resolve()));
      }),
    commit: () =>
      new Promise<void>((resolve, reject) => {
        conn.commit((err) => (err ? reject(err) : resolve()));
      }),
    rollback: () =>
      new Promise<void>((resolve, reject) => {
        conn.rollback((err) => (err ? reject(err) : resolve()));
      }),
    release: () => conn.release(),
  };
}

export type DbConnection = ReturnType<typeof wrapConnection>;

const rawPool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: 10,
  connectTimeout: 10_000,
});

const pool = {
  query: <T>(sql: string, params?: unknown[]) => runQuery<T>(rawPool, sql, params),
  getConnection: () =>
    new Promise<DbConnection>((resolve, reject) => {
      rawPool.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(wrapConnection(conn));
      });
    }),
};

export default pool;

export type {
  ResultSetHeader,
  RowDataPacket,
  ProfileRow,
  MedicationRow,
  DoseLogRow,
  CountRow,
  LastDoseRow,
  IdRow,
} from "./dbTypes.js";
