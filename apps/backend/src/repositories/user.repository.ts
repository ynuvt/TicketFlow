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
      await prisma.user.upsert({
        where: { username: 'admin' },
        update: { fullName: 'admin', assignedStations: ['intake', 'prep', 'grill', 'assembly', 'expedite'] },
        create: {
          id: 'user-admin',
          username: 'admin',
          password: 'admin123',
          fullName: 'admin',
          role: 'MANAGER',
          assignedStations: ['intake', 'prep', 'grill', 'assembly', 'expedite'],
          stationPrepTimes: {},
        },
      });

      // 2. Kitchen Staff Cook 1 (Prep)
      await prisma.user.upsert({
        where: { username: 'cook1' },
        update: { fullName: 'cook1', assignedStations: ['prep'], stationPrepTimes: { prep: 5 } },
        create: {
          id: 'user-cook1',
          username: 'cook1',
          password: 'pass123',
          fullName: 'cook1',
          role: 'STAFF',
          assignedStations: ['prep'],
          stationPrepTimes: { prep: 5 },
        },
      });

      // 3. Kitchen Staff Cook 2 (Prep)
      await prisma.user.upsert({
        where: { username: 'cook2' },
        update: { fullName: 'cook2', assignedStations: ['prep'], stationPrepTimes: { prep: 5 } },
        create: {
          id: 'user-cook2',
          username: 'cook2',
          password: 'pass123',
          fullName: 'cook2',
          role: 'STAFF',
          assignedStations: ['prep'],
          stationPrepTimes: { prep: 5 },
        },
      });

      // 4. Kitchen Staff Cook 3 (Grill)
      await prisma.user.upsert({
        where: { username: 'cook3' },
        update: { fullName: 'cook3', assignedStations: ['grill'], stationPrepTimes: { grill: 6 } },
        create: {
          id: 'user-cook3',
          username: 'cook3',
          password: 'pass123',
          fullName: 'cook3',
          role: 'STAFF',
          assignedStations: ['grill'],
          stationPrepTimes: { grill: 6 },
        },
      });

      // 5. Kitchen Staff Cook 4 (Grill)
      await prisma.user.upsert({
        where: { username: 'cook4' },
        update: { fullName: 'cook4', assignedStations: ['grill'], stationPrepTimes: { grill: 6 } },
        create: {
          id: 'user-cook4',
          username: 'cook4',
          password: 'pass123',
          fullName: 'cook4',
          role: 'STAFF',
          assignedStations: ['grill'],
          stationPrepTimes: { grill: 6 },
        },
      });

      // 6. Kitchen Staff Cook 5 (Assembly)
      await prisma.user.upsert({
        where: { username: 'cook5' },
        update: { fullName: 'cook5', assignedStations: ['assembly'], stationPrepTimes: { assembly: 5 } },
        create: {
          id: 'user-cook5',
          username: 'cook5',
          password: 'pass123',
          fullName: 'cook5',
          role: 'STAFF',
          assignedStations: ['assembly'],
          stationPrepTimes: { assembly: 5 },
        },
      });

      // 7. Kitchen Staff Cook 6 (Assembly)
      await prisma.user.upsert({
        where: { username: 'cook6' },
        update: { fullName: 'cook6', assignedStations: ['assembly'], stationPrepTimes: { assembly: 5 } },
        create: {
          id: 'user-cook6',
          username: 'cook6',
          password: 'pass123',
          fullName: 'cook6',
          role: 'STAFF',
          assignedStations: ['assembly'],
          stationPrepTimes: { assembly: 5 },
        },
      });

      // 8. Kitchen Staff Cook 7 (Expedite)
      await prisma.user.upsert({
        where: { username: 'cook7' },
        update: { fullName: 'cook7', assignedStations: ['expedite'], stationPrepTimes: { expedite: 4 } },
        create: {
          id: 'user-cook7',
          username: 'cook7',
          password: 'pass123',
          fullName: 'cook7',
          role: 'STAFF',
          assignedStations: ['expedite'],
          stationPrepTimes: { expedite: 4 },
        },
      });

      // 9. Kitchen Staff Cook 8 (Expedite)
      await prisma.user.upsert({
        where: { username: 'cook8' },
        update: { fullName: 'cook8', assignedStations: ['expedite'], stationPrepTimes: { expedite: 4 } },
        create: {
          id: 'user-cook8',
          username: 'cook8',
          password: 'pass123',
          fullName: 'cook8',
          role: 'STAFF',
          assignedStations: ['expedite'],
          stationPrepTimes: { expedite: 4 },
        },
      });

      // 10. Receptionist Desk
      await prisma.user.upsert({
        where: { username: 'recep1' },
        update: { fullName: 'recep1', assignedStations: ['intake'] },
        create: {
          id: 'user-recep1',
          username: 'recep1',
          password: 'recep123',
          fullName: 'recep1',
          role: 'RECEPTIONIST',
          assignedStations: ['intake'],
          stationPrepTimes: {},
        },
      });
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
