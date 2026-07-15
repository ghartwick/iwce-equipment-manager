import { Firestore } from 'firebase-admin/firestore';
import { LlmToolDef } from './provider.js';

/** Authenticated user resolved server-side (authoritative role from Firestore). */
export interface AgentUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'supervisor' | 'field';
}

export interface ToolContext {
  db: Firestore;
  user: AgentUser;
}

type Role = AgentUser['role'];
const ROLE_RANK: Record<Role, number> = { field: 0, supervisor: 1, admin: 2 };

export interface AgentTool {
  def: LlmToolDef;
  /** Minimum role required to use this tool. Defaults to 'field'. */
  minRole?: Role;
  /** True for tools that mutate data (deferred to Phase 3; kept out for now). */
  mutates?: boolean;
  handler: (input: any, ctx: ToolContext) => Promise<any>;
}

// --- helpers ---------------------------------------------------------------

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function getAllUsers(db: Firestore): Promise<AgentUser[]> {
  const snap = await db.collection('users').get();
  return snap.docs.map(d => {
    const data = d.data();
    const role = (data.role === 'technician' ? 'field' : data.role) as Role;
    return { id: d.id, username: data.username, name: data.name, role };
  });
}

const EQUIPMENT_COLLECTIONS = ['fieldTools', 'heavyEquipment', 'fleetEquipment', 'smallTools'];

// --- tool registry ---------------------------------------------------------

export const TOOLS: Record<string, AgentTool> = {
  list_clients: {
    def: {
      name: 'list_clients',
      description: 'List all clients in the system, optionally filtering to only active clients. Returns id, name, description and active status.',
      input_schema: {
        type: 'object',
        properties: {
          activeOnly: { type: 'boolean', description: 'If true, only return active clients.' },
        },
      },
    },
    handler: async (input, { db }) => {
      const snap = await db.collection('clients').get();
      let clients = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, name: data.name, description: data.description || '', isActive: data.isActive ?? true };
      });
      if (input?.activeOnly) clients = clients.filter(c => c.isActive);
      clients.sort((a, b) => a.name.localeCompare(b.name));
      return { count: clients.length, clients };
    },
  },

  list_sites: {
    def: {
      name: 'list_sites',
      description: 'List all job sites, optionally filtering to only active sites. Returns id, name, description and active status.',
      input_schema: {
        type: 'object',
        properties: {
          activeOnly: { type: 'boolean', description: 'If true, only return active sites.' },
        },
      },
    },
    handler: async (input, { db }) => {
      const snap = await db.collection('sites').get();
      let sites = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, name: data.name, description: data.description || '', isActive: data.isActive ?? true };
      });
      if (input?.activeOnly) sites = sites.filter(s => s.isActive);
      sites.sort((a, b) => a.name.localeCompare(b.name));
      return { count: sites.length, sites };
    },
  },

  search_equipment: {
    def: {
      name: 'search_equipment',
      description: 'Search all equipment (field tools, heavy equipment, fleet, small tools) by name or serial number. Returns matching equipment with id, name, type, site, assigned employee, and repair status. Omit query to list everything (capped).',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Case-insensitive text to match against equipment name or serial number.' },
          limit: { type: 'number', description: 'Max results to return (default 25).' },
        },
      },
    },
    handler: async (input, { db }) => {
      const q = (input?.query || '').toString().toLowerCase().trim();
      const limit = Math.min(Number(input?.limit) || 25, 100);
      const results: any[] = [];
      for (const coll of EQUIPMENT_COLLECTIONS) {
        const snap = await db.collection(coll).get();
        for (const d of snap.docs) {
          const data = d.data();
          const name = (data.name || '').toString();
          const serial = (data.serialNumber || '').toString();
          if (!q || name.toLowerCase().includes(q) || serial.toLowerCase().includes(q)) {
            results.push({
              id: d.id,
              name,
              collection: coll,
              equipmentType: data.equipmentType || null,
              site: data.site || null,
              employee: data.employee || null,
              serialNumber: serial || null,
              repair: data.repair ?? false,
            });
          }
        }
      }
      results.sort((a, b) => a.name.localeCompare(b.name));
      return { count: results.length, truncated: results.length > limit, equipment: results.slice(0, limit) };
    },
  },

  get_equipment_maintenance_history: {
    def: {
      name: 'get_equipment_maintenance_history',
      description: 'Get maintenance reports for a specific piece of equipment by its id. Returns each report date, who created it, hours, and any notes. Use search_equipment first to find the equipment id.',
      input_schema: {
        type: 'object',
        properties: {
          equipmentId: { type: 'string', description: 'The equipment document id.' },
          limit: { type: 'number', description: 'Max reports to return (default 20).' },
        },
        required: ['equipmentId'],
      },
    },
    handler: async (input, { db }) => {
      const limit = Math.min(Number(input?.limit) || 20, 100);
      const snap = await db.collection('maintenanceHistory').where('equipmentId', '==', input.equipmentId).get();
      const reports = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            equipmentName: data.equipmentName,
            createdAt: toIso(data.createdAt),
            createdBy: data.createdBy,
            hours: data.maintenance?.hours ?? null,
            notes: data.maintenance?.notes || '',
          };
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return { count: reports.length, reports: reports.slice(0, limit) };
    },
  },

  list_time_entries: {
    def: {
      name: 'list_time_entries',
      description:
        "List survey time entries. Field users only see their own entries. Supervisors and admins may pass a username to view another user's entries. Returns date, client, site, hours, status.",
      input_schema: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Only admins/supervisors: whose entries to fetch. Defaults to the current user.' },
          limit: { type: 'number', description: 'Max entries to return (default 25).' },
        },
      },
    },
    handler: async (input, { db, user }) => {
      const limit = Math.min(Number(input?.limit) || 25, 100);
      let targetUserId = user.id;

      if (input?.username && input.username !== user.username) {
        if (user.role === 'field') {
          throw new Error('Field users can only view their own time entries.');
        }
        const users = await getAllUsers(db);
        const match = users.find(u => u.username.toLowerCase() === input.username.toLowerCase());
        if (!match) throw new Error(`No user found with username "${input.username}".`);
        targetUserId = match.id;
      }

      const snap = await db.collection('surveyTimeEntries').where('userId', '==', targetUserId).get();
      const entries = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            date: toIso(data.date),
            clientName: data.clientName || '',
            site: data.site || '',
            hours: data.hours ?? 0,
            travelHours: data.travelHours ?? 0,
            status: data.status || 'draft',
          };
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return { count: entries.length, entries: entries.slice(0, limit) };
    },
  },

  list_users: {
    def: {
      name: 'list_users',
      description: 'List all user accounts (admin only). Returns username, name, role and active status.',
      input_schema: { type: 'object', properties: {} },
    },
    minRole: 'admin',
    handler: async (_input, { db }) => {
      const snap = await db.collection('users').get();
      const users = snap.docs.map(d => {
        const data = d.data();
        return {
          username: data.username,
          name: data.name,
          role: data.role === 'technician' ? 'field' : data.role,
          isActive: data.isActive ?? true,
        };
      });
      users.sort((a, b) => a.name.localeCompare(b.name));
      return { count: users.length, users };
    },
  },
};

/** Tool definitions the current user is allowed to see/use, based on role. */
export function getToolDefsForUser(user: AgentUser): LlmToolDef[] {
  return Object.values(TOOLS)
    .filter(t => ROLE_RANK[user.role] >= ROLE_RANK[t.minRole || 'field'])
    .map(t => t.def);
}

/** Execute a tool by name with access-control enforcement. */
export async function executeTool(name: string, input: any, ctx: ToolContext): Promise<any> {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (ROLE_RANK[ctx.user.role] < ROLE_RANK[tool.minRole || 'field']) {
    throw new Error(`You do not have permission to use "${name}".`);
  }
  return tool.handler(input || {}, ctx);
}
