import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// === DB 경로 ===

const DB_DIR = path.join(os.homedir(), '.mac-pilot');
const DB_PATH = path.join(DB_DIR, 'pilot.db');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// === Database 클래스 ===

export class PilotDatabase {
  readonly db: DatabaseType;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? DB_PATH;
    const dir = path.dirname(resolvedPath);
    ensureDir(dir);
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      -- 액션 실행 로그
      CREATE TABLE IF NOT EXISTS action_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        app_context TEXT,
        params TEXT NOT NULL,
        result TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        duration_ms INTEGER,
        script_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_action_log_app ON action_log(app_context);
      CREATE INDEX IF NOT EXISTS idx_action_log_type ON action_log(action_type);
      CREATE INDEX IF NOT EXISTS idx_action_log_success ON action_log(success);
      CREATE INDEX IF NOT EXISTS idx_action_log_created ON action_log(created_at);

      -- 레시피
      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        app TEXT,
        steps TEXT NOT NULL,
        parameters TEXT,
        tags TEXT,
        run_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        last_run_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_recipes_app ON recipes(app);
      CREATE INDEX IF NOT EXISTS idx_recipes_run_count ON recipes(run_count DESC);

      -- 레시피 FTS
      CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
        name,
        description,
        tags,
        content='recipes',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS recipes_ai AFTER INSERT ON recipes BEGIN
        INSERT INTO recipes_fts(rowid, name, description, tags)
        VALUES (new.id, new.name, new.description, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS recipes_ad AFTER DELETE ON recipes BEGIN
        INSERT INTO recipes_fts(recipes_fts, rowid, name, description, tags)
        VALUES ('delete', old.id, old.name, old.description, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS recipes_au AFTER UPDATE ON recipes BEGIN
        INSERT INTO recipes_fts(recipes_fts, rowid, name, description, tags)
        VALUES ('delete', old.id, old.name, old.description, old.tags);
        INSERT INTO recipes_fts(rowid, name, description, tags)
        VALUES (new.id, new.name, new.description, new.tags);
      END;

      -- 액션 로그 FTS
      CREATE VIRTUAL TABLE IF NOT EXISTS action_log_fts USING fts5(
        params,
        error_message,
        content='action_log',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS action_log_ai AFTER INSERT ON action_log BEGIN
        INSERT INTO action_log_fts(rowid, params, error_message)
        VALUES (new.id, new.params, COALESCE(new.error_message, ''));
      END;

      -- 앱별 학습 지식
      CREATE TABLE IF NOT EXISTS app_knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        knowledge_type TEXT NOT NULL,
        content TEXT NOT NULL,
        reliability REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_app_knowledge_app ON app_knowledge(app_name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_app_knowledge_unique
        ON app_knowledge(app_name, knowledge_type, content);

      -- 보안 감사 로그
      CREATE TABLE IF NOT EXISTS security_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        details TEXT NOT NULL,
        allowed INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // === Action Log ===

  logAction(entry: {
    actionType: string;
    appContext?: string;
    params: string;
    result?: string;
    success: boolean;
    errorMessage?: string;
    durationMs?: number;
    scriptHash?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO action_log (action_type, app_context, params, result, success, error_message, duration_ms, script_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      entry.actionType,
      entry.appContext ?? null,
      entry.params,
      entry.result ?? null,
      entry.success ? 1 : 0,
      entry.errorMessage ?? null,
      entry.durationMs ?? null,
      entry.scriptHash ?? null,
    );
    return Number(info.lastInsertRowid);
  }

  getActionLog(options?: { app?: string; limit?: number; successOnly?: boolean }): Array<{
    id: number;
    action_type: string;
    app_context: string | null;
    params: string;
    result: string | null;
    success: number;
    error_message: string | null;
    duration_ms: number | null;
    created_at: string;
  }> {
    let query = 'SELECT * FROM action_log WHERE 1=1';
    const params: unknown[] = [];

    if (options?.app) {
      query += ' AND app_context = ?';
      params.push(options.app);
    }
    if (options?.successOnly) {
      query += ' AND success = 1';
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return this.db.prepare(query).all(...params) as Array<{
      id: number;
      action_type: string;
      app_context: string | null;
      params: string;
      result: string | null;
      success: number;
      error_message: string | null;
      duration_ms: number | null;
      created_at: string;
    }>;
  }

  // === Recipes ===

  saveRecipe(recipe: {
    name: string;
    description: string;
    app?: string;
    steps: string;
    parameters?: string;
    tags?: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO recipes (name, description, app, steps, parameters, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      recipe.name,
      recipe.description,
      recipe.app ?? null,
      recipe.steps,
      recipe.parameters ?? null,
      recipe.tags ?? null,
    );
    return Number(info.lastInsertRowid);
  }

  getRecipe(name: string): {
    id: number;
    name: string;
    description: string;
    app: string | null;
    steps: string;
    parameters: string | null;
    tags: string | null;
    run_count: number;
    success_count: number;
    last_run_at: string | null;
    created_at: string;
    updated_at: string;
  } | undefined {
    return this.db.prepare('SELECT * FROM recipes WHERE name = ?').get(name) as {
      id: number;
      name: string;
      description: string;
      app: string | null;
      steps: string;
      parameters: string | null;
      tags: string | null;
      run_count: number;
      success_count: number;
      last_run_at: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;
  }

  updateRecipeStats(name: string, success: boolean): void {
    this.db.prepare(`
      UPDATE recipes
      SET run_count = run_count + 1,
          success_count = success_count + CASE WHEN ? THEN 1 ELSE 0 END,
          last_run_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `).run(success ? 1 : 0, name);
  }

  searchRecipes(query: string, app?: string): Array<{
    id: number;
    name: string;
    description: string;
    app: string | null;
    run_count: number;
    success_count: number;
    rank: number;
  }> {
    let sql: string;
    const params: unknown[] = [];

    if (app) {
      sql = `
        SELECT r.id, r.name, r.description, r.app, r.run_count, r.success_count, rank
        FROM recipes_fts f
        JOIN recipes r ON r.id = f.rowid
        WHERE recipes_fts MATCH ? AND r.app = ?
        ORDER BY rank
        LIMIT 20
      `;
      params.push(query, app);
    } else {
      sql = `
        SELECT r.id, r.name, r.description, r.app, r.run_count, r.success_count, rank
        FROM recipes_fts f
        JOIN recipes r ON r.id = f.rowid
        WHERE recipes_fts MATCH ?
        ORDER BY rank
        LIMIT 20
      `;
      params.push(query);
    }

    return this.db.prepare(sql).all(...params) as Array<{
      id: number;
      name: string;
      description: string;
      app: string | null;
      run_count: number;
      success_count: number;
      rank: number;
    }>;
  }

  searchActionLog(query: string): Array<{
    id: number;
    action_type: string;
    app_context: string | null;
    params: string;
    error_message: string | null;
    success: number;
  }> {
    return this.db.prepare(`
      SELECT a.id, a.action_type, a.app_context, a.params, a.error_message, a.success
      FROM action_log_fts f
      JOIN action_log a ON a.id = f.rowid
      WHERE action_log_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `).all(query) as Array<{
      id: number;
      action_type: string;
      app_context: string | null;
      params: string;
      error_message: string | null;
      success: number;
    }>;
  }

  // === App Knowledge ===

  saveAppKnowledge(entry: {
    appName: string;
    knowledgeType: string;
    content: string;
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO app_knowledge (app_name, knowledge_type, content)
      VALUES (?, ?, ?)
      ON CONFLICT(app_name, knowledge_type, content) DO UPDATE SET
        reliability = MIN(reliability + 0.1, 1.0),
        updated_at = CURRENT_TIMESTAMP
    `);
    const info = stmt.run(entry.appName, entry.knowledgeType, entry.content);
    return Number(info.lastInsertRowid);
  }

  getAppKnowledge(appName: string): Array<{
    id: number;
    knowledge_type: string;
    content: string;
    reliability: number;
  }> {
    return this.db.prepare(
      'SELECT id, knowledge_type, content, reliability FROM app_knowledge WHERE app_name = ? AND reliability > 0.3 ORDER BY reliability DESC'
    ).all(appName) as Array<{
      id: number;
      knowledge_type: string;
      content: string;
      reliability: number;
    }>;
  }

  decreaseKnowledgeReliability(id: number): void {
    this.db.prepare(
      'UPDATE app_knowledge SET reliability = MAX(reliability - 0.2, 0.0), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(id);
  }

  // === Security Log ===

  logSecurity(entry: {
    actionType: string;
    riskLevel: string;
    details: string;
    allowed: boolean;
  }): void {
    this.db.prepare(`
      INSERT INTO security_log (action_type, risk_level, details, allowed)
      VALUES (?, ?, ?, ?)
    `).run(entry.actionType, entry.riskLevel, entry.details, entry.allowed ? 1 : 0);
  }

  getSecurityLog(limit: number = 50): Array<{
    id: number;
    action_type: string;
    risk_level: string;
    details: string;
    allowed: number;
    created_at: string;
  }> {
    return this.db.prepare(
      'SELECT * FROM security_log ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Array<{
      id: number;
      action_type: string;
      risk_level: string;
      details: string;
      allowed: number;
      created_at: string;
    }>;
  }

  // === Built-in Recipes ===

  loadBuiltinRecipes(recipes: Array<{
    name: string;
    description: string;
    app?: string;
    steps: Array<{ actionType: string; params: Record<string, unknown>; description: string }>;
    tags: string[];
  }>): number {
    let loaded = 0;
    for (const recipe of recipes) {
      const existing = this.getRecipe(recipe.name);
      if (!existing) {
        this.saveRecipe({
          name: recipe.name,
          description: recipe.description,
          app: recipe.app,
          steps: JSON.stringify(recipe.steps),
          tags: JSON.stringify(recipe.tags),
        });
        loaded++;
      }
    }
    return loaded;
  }

  // === Cleanup ===

  cleanupOldLogs(maxAge: number = 30 * 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - maxAge).toISOString();
    const result = this.db.prepare('DELETE FROM action_log WHERE created_at < ?').run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}

// 기본 인스턴스 (lazy)
let defaultInstance: PilotDatabase | null = null;

export function getDatabase(): PilotDatabase {
  if (!defaultInstance) {
    defaultInstance = new PilotDatabase();
  }
  return defaultInstance;
}

export function createTestDatabase(): PilotDatabase {
  return new PilotDatabase(':memory:');
}
