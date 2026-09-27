import { DataSource } from 'typeorm';
import { Branch } from '../../modules/branches/entities/branch.entity';
import { RestaurantTable } from '../../modules/tables/entities/table.entity';
import { RESTAURANT_ID } from './restaurant.seed';

export const MAIN_BRANCH_ID = '77777777-7777-7777-7777-777777777777';

export async function seedBranches(dataSource: DataSource) {
  const branchRepo = dataSource.getRepository(Branch);
  const tableRepo = dataSource.getRepository(RestaurantTable);

  let branch = await branchRepo.findOne({ where: { id: MAIN_BRANCH_ID } });

  if (!branch) {
    branch = branchRepo.create({
      id: MAIN_BRANCH_ID,
      name: 'Main Flagship Bistro',
      addressLine: '123 Food Street, Tech Hub',
      city: 'Bengaluru',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      phone: '9999999999',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
      isActive: true,
      acceptingOrders: true,
      serviceRadiusKm: 15,
      openingTime: '09:00:00',
      closingTime: '23:00:00',
      restaurantId: RESTAURANT_ID,
    });
    await branchRepo.save(branch);
    console.log(`✅ Created branch: ${branch.name}`);
  } else {
    console.log(`⏭️  Branch ${branch.name} already exists`);
  }

  // Seed sample tables with QR codes
  const sampleTables = [
    { tableNumber: '1', qrToken: 'table_1_qr_token_default' },
    { tableNumber: '2', qrToken: 'table_2_qr_token_default' },
    { tableNumber: '3', qrToken: 'table_3_qr_token_default' },
    { tableNumber: '4', qrToken: 'table_4_qr_token_default' },
    { tableNumber: '5', qrToken: 'table_5_qr_token_default' },
  ];

  for (const t of sampleTables) {
    const exists = await tableRepo.findOne({
      where: { branchId: branch.id, tableNumber: t.tableNumber },
    });
    if (!exists) {
      const table = tableRepo.create({
        branchId: branch.id,
        tableNumber: t.tableNumber,
        qrToken: t.qrToken,
        isActive: true,
      });
      await tableRepo.save(table);
      console.log(`✅ Created Table #${t.tableNumber} (QR Token: ${t.qrToken})`);
    }
  }
}
