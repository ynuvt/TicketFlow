import { prisma } from '../lib/prisma';

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  role?: 'MANAGER' | 'STAFF' | 'RECEPTIONIST';
  assignedStations?: string[];
  stationPrepTimes?: any;
}

export interface UpdateUserInput {
  id: string;
  fullName?: string;
  password?: string;
  role?: 'MANAGER' | 'STAFF' | 'RECEPTIONIST';
  assignedStations?: string[];
  stationPrepTimes?: any;
}

export class UserRepository {
  // Ensure default accounts exist in DB
  public async ensureDefaultUsers() {
    try {
      // 1. Manager Admin
      const existingAdmin = await prisma.user.findUnique({
        where: { username: 'admin' },
      });
      if (!existingAdmin) {
        await prisma.user.create({
          data: {
            username: 'admin',
            password: 'admin123',
            fullName: 'Admin Manager',
            role: 'MANAGER',
            assignedStations: ['intake', 'prep', 'grill', 'assembly', 'expedite'],
            stationPrepTimes: {},
          },
        });
        console.log('[Auth DB] Initialized default Admin Manager account (username: admin, pass: admin123)');
      }

      // 2. Kitchen Staff Cook
      const existingCook = await prisma.user.findUnique({
        where: { username: 'cook1' },
      });
      if (!existingCook) {
        await prisma.user.create({
          data: {
            username: 'cook1',
            password: 'pass123',
            fullName: 'Prep & Grill Cook',
            role: 'STAFF',
            assignedStations: ['prep', 'grill'],
            stationPrepTimes: { prep: 5, grill: 7 },
          },
        });
        console.log('[Auth DB] Initialized default Staff Cook account (username: cook1, pass: pass123)');
      }

      // 3. Receptionist Desk
      const existingRecep = await prisma.user.findUnique({
        where: { username: 'recep1' },
      });
      if (!existingRecep) {
        await prisma.user.create({
          data: {
            username: 'recep1',
            password: 'recep123',
            fullName: 'Reception Desk',
            role: 'RECEPTIONIST',
            assignedStations: ['intake'],
            stationPrepTimes: {},
          },
        });
        console.log('[Auth DB] Initialized default Receptionist account (username: recep1, pass: recep123)');
      }
    } catch (err: any) {
      console.error('[Auth DB] Failed to ensure default users:', err.message);
    }
  }

  public async findByUsername(username: string) {
    await this.ensureDefaultUsers();
    return prisma.user.findUnique({
      where: { username },
    });
  }

  public async getAllUsers() {
    await this.ensureDefaultUsers();
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
        stationPrepTimes: input.stationPrepTimes || {},
      },
    });
  }

  public async updateUser(input: UpdateUserInput) {
    const data: any = {};
    if (input.fullName) data.fullName = input.fullName;
    if (input.password) data.password = input.password;
    if (input.role) data.role = input.role;
    if (input.assignedStations) data.assignedStations = input.assignedStations;
    if (input.stationPrepTimes) data.stationPrepTimes = input.stationPrepTimes;

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
