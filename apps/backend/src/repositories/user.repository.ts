import { prisma } from '../lib/prisma';

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  role?: 'MANAGER' | 'STAFF';
  assignedStations?: string[];
}

export interface UpdateUserInput {
  id: string;
  fullName?: string;
  password?: string;
  role?: 'MANAGER' | 'STAFF';
  assignedStations?: string[];
}

export class UserRepository {
  // Ensure default Admin Manager exists in DB
  public async ensureAdminUser() {
    try {
      const existing = await prisma.user.findUnique({
        where: { username: 'admin' },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            username: 'admin',
            password: 'admin123',
            fullName: 'Admin Manager',
            role: 'MANAGER',
            assignedStations: ['intake', 'prep', 'grill', 'assembly', 'expedite'],
          },
        });
        console.log('[Auth DB] Initialized default Admin Manager account (username: admin, pass: admin123)');
      }
    } catch (err: any) {
      console.error('[Auth DB] Failed to ensure admin user:', err.message);
    }
  }

  public async findByUsername(username: string) {
    await this.ensureAdminUser();
    return prisma.user.findUnique({
      where: { username },
    });
  }

  public async getAllUsers() {
    await this.ensureAdminUser();
    return prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  public async createUser(input: CreateUserInput) {
    return prisma.user.create({
      data: {
        username: input.username,
        password: input.password,
        fullName: input.fullName,
        role: input.role || 'STAFF',
        assignedStations: input.assignedStations || ['intake', 'prep', 'grill', 'assembly', 'expedite'],
      },
    });
  }

  public async updateUser(input: UpdateUserInput) {
    const data: any = {};
    if (input.fullName) data.fullName = input.fullName;
    if (input.password) data.password = input.password;
    if (input.role) data.role = input.role;
    if (input.assignedStations) data.assignedStations = input.assignedStations;

    return prisma.user.update({
      where: { id: input.id },
      data,
    });
  }

  public async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }
}

export const userRepository = new UserRepository();
