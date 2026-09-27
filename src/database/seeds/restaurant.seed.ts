import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Restaurant } from '../../modules/restaurants/entities/restaurant.entity';
import { Role } from '../../common/enums/role.enum';

export const RESTAURANT_ID = '68e85e16-9389-4628-a0ef-fdddff815016';
export const OWNER_ID = '11111111-1111-1111-1111-111111111111';

export async function seedRestaurant(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const restaurantRepo = dataSource.getRepository(Restaurant);

  // 1. Ensure Owner User exists
  let owner = await userRepo.findOne({ where: { id: OWNER_ID } });
  if (!owner) {
    owner = await userRepo.findOne({ where: { phone: '9999999999' } });
  }

  if (!owner) {
    owner = userRepo.create({
      id: OWNER_ID,
      fullName: 'Restaurant Owner',
      phone: '9999999999',
      email: 'owner@foodapp.com',
      role: Role.RESTAURANT_OWNER,
      isActive: true,
    });
    await userRepo.save(owner);
    console.log('✅ Created restaurant owner user');
  } else {
    console.log('⏭️  Restaurant owner user already exists');
  }

  // 2. Ensure Restaurant exists
  const existingRestaurant = await restaurantRepo.findOne({ where: { id: RESTAURANT_ID } });
  if (!existingRestaurant) {
    const restaurant = restaurantRepo.create({
      id: RESTAURANT_ID,
      name: 'Flavors Bistro',
      description: 'Gourmet burgers, stone-fired pizza, and artisanal cafe dining.',
      address: '123 Food Street, Tech Hub',
      phone: '9999999999',
      logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
      rating: 4.8,
      isActive: true,
      baseDeliveryFee: 20,
      perKmDeliveryFee: 6,
      taxPercent: 5,
      dineInDiscountPercent: 10,
      ownerId: owner.id,
    });
    await restaurantRepo.save(restaurant);
    console.log(`✅ Created restaurant: ${restaurant.name} (${RESTAURANT_ID})`);
  } else {
    console.log(`⏭️  Restaurant ${existingRestaurant.name} already exists`);
  }
}
