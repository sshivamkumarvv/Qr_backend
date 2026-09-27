import { AppDataSource } from './data-source';

// import { seedRestaurant } from './seeds/restaurant.seed';
// import { seedCategories } from './seeds/category.seed';
import { seedMenu } from './seeds/menu.seed';
// import { seedBranches } from './seeds/branch.seed';

async function bootstrap() {
  await AppDataSource.initialize();

  console.log('🌱 Seeding database...');

//   await seedRestaurant(AppDataSource);
//   await seedCategories(AppDataSource);
  await seedMenu(AppDataSource);
//   await seedBranches(AppDataSource);

  console.log('✅ Database seeded successfully');

  await AppDataSource.destroy();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});