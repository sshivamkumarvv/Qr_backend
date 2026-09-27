import { DataSource } from 'typeorm';
import { MenuItem } from '../../modules/menu-items/entities/menu-item.entity';

const RESTAURANT_ID = '68e85e16-9389-4628-a0ef-fdddff815016';

const CATEGORY = {
  COFFEE: '0112e51d-3ac8-4572-87a0-077ae2d809f9',
  BURGERS: '220762d3-0831-4539-8569-4d8757e665bf',
  TEA: '24852cf5-41d5-4edb-9ee0-7a88db127e08',
  SNACKS: '4de6b1fa-848d-4a3c-b753-2831f816b2c1',
  MEALS: '532ea23e-af20-418c-8b1f-4681bc242dca',
  BREAKFAST: '86cae9af-ebee-484e-aea0-954ffedc65e1',
  DESSERTS: 'b96fc9df-fe88-4fd2-8ba6-3208ffcdb8cc',
  PIZZA: 'd62d2ffb-7350-4550-be1e-ee471eb41921',
};

const items = [
  // Burgers
  { name: 'Classic Veg Burger', description: 'Grilled veg patty with lettuce, tomato and cheese.', price: 199.0, discountedPrice: 179.0, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800', isVeg: true, isFeatured: true, displayOrder: 1, preparationTime: 15, categoryId: CATEGORY.BURGERS },
  { name: 'Cheese Burger', description: 'Juicy burger with cheddar cheese.', price: 249.0, discountedPrice: 219.0, imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800', isVeg: false, isFeatured: true, displayOrder: 2, preparationTime: 18, categoryId: CATEGORY.BURGERS },
  { name: 'Paneer Burger', description: 'Grilled paneer with spicy mayo.', price: 229.0, discountedPrice: 199.0, imageUrl: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=800', isVeg: true, isFeatured: false, displayOrder: 3, preparationTime: 15, categoryId: CATEGORY.BURGERS },
  { name: 'Chicken Burger', description: 'Crispy fried chicken with pickles and mayo.', price: 259.0, discountedPrice: 229.0, imageUrl: 'https://images.unsplash.com/photo-1550317138-10000687a72b?w=800', isVeg: false, isFeatured: true, displayOrder: 4, preparationTime: 18, categoryId: CATEGORY.BURGERS },
  { name: 'Double Patty Burger', description: 'Two grilled patties stacked with double cheese.', price: 299.0, discountedPrice: 269.0, imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800', isVeg: false, isFeatured: false, displayOrder: 5, preparationTime: 20, categoryId: CATEGORY.BURGERS },

  // Pizza
  { name: 'Margherita Pizza', description: 'Classic mozzarella pizza.', price: 349.0, discountedPrice: 299.0, imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', isVeg: true, isFeatured: true, displayOrder: 1, preparationTime: 20, categoryId: CATEGORY.PIZZA },
  { name: 'Farmhouse Pizza', description: 'Loaded with vegetables.', price: 429.0, discountedPrice: 389.0, imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800', isVeg: true, isFeatured: false, displayOrder: 2, preparationTime: 22, categoryId: CATEGORY.PIZZA },
  { name: 'BBQ Chicken Pizza', description: 'Chicken with smoky BBQ sauce.', price: 499.0, discountedPrice: 459.0, imageUrl: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800', isVeg: false, isFeatured: true, displayOrder: 3, preparationTime: 25, categoryId: CATEGORY.PIZZA },
  { name: 'Pepperoni Pizza', description: 'Loaded with spicy pepperoni and mozzarella.', price: 459.0, discountedPrice: 419.0, imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800', isVeg: false, isFeatured: true, displayOrder: 4, preparationTime: 22, categoryId: CATEGORY.PIZZA },
  { name: 'Veggie Supreme Pizza', description: 'Bell peppers, olives, corn, and onion.', price: 419.0, discountedPrice: 379.0, imageUrl: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=800', isVeg: true, isFeatured: false, displayOrder: 5, preparationTime: 22, categoryId: CATEGORY.PIZZA },

  // Meals
  { name: 'Grilled Chicken Meal', description: 'Chicken, rice and veggies.', price: 399.0, discountedPrice: 359.0, imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800', isVeg: false, isFeatured: true, displayOrder: 1, preparationTime: 20, categoryId: CATEGORY.MEALS },
  { name: 'Paneer Rice Bowl', description: 'Paneer with herbed rice.', price: 299.0, discountedPrice: 269.0, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', isVeg: true, isFeatured: false, displayOrder: 2, preparationTime: 18, categoryId: CATEGORY.MEALS },
  { name: 'Butter Chicken Meal', description: 'Creamy butter chicken with naan and rice.', price: 449.0, discountedPrice: 399.0, imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800', isVeg: false, isFeatured: true, displayOrder: 3, preparationTime: 25, categoryId: CATEGORY.MEALS },
  { name: 'Veg Thali', description: 'Dal, sabzi, roti, rice and salad.', price: 349.0, discountedPrice: 309.0, imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800', isVeg: true, isFeatured: false, displayOrder: 4, preparationTime: 20, categoryId: CATEGORY.MEALS },

  // Snacks
  { name: 'French Fries', description: 'Crispy salted fries.', price: 149.0, discountedPrice: 129.0, imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800', isVeg: true, isFeatured: true, displayOrder: 1, preparationTime: 10, categoryId: CATEGORY.SNACKS },
  { name: 'Garlic Bread', description: 'Toasted garlic bread.', price: 169.0, discountedPrice: 149.0, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', isVeg: true, isFeatured: false, displayOrder: 2, preparationTime: 10, categoryId: CATEGORY.SNACKS },
  { name: 'Onion Rings', description: 'Crispy battered onion rings.', price: 159.0, discountedPrice: 139.0, imageUrl: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=800', isVeg: true, isFeatured: false, displayOrder: 3, preparationTime: 10, categoryId: CATEGORY.SNACKS },
  { name: 'Mozzarella Sticks', description: 'Golden fried mozzarella with marinara dip.', price: 219.0, discountedPrice: 189.0, imageUrl: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=800', isVeg: true, isFeatured: true, displayOrder: 4, preparationTime: 12, categoryId: CATEGORY.SNACKS },

  // Coffee
  { name: 'Cappuccino', description: 'Freshly brewed cappuccino.', price: 149.0, discountedPrice: 129.0, imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800', isVeg: true, isFeatured: false, displayOrder: 1, preparationTime: 5, categoryId: CATEGORY.COFFEE },
  { name: 'Cafe Latte', description: 'Smooth latte.', price: 169.0, discountedPrice: 149.0, imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800', isVeg: true, isFeatured: true, displayOrder: 2, preparationTime: 5, categoryId: CATEGORY.COFFEE },
  { name: 'Espresso', description: 'Strong and bold single shot.', price: 119.0, discountedPrice: 99.0, imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800', isVeg: true, isFeatured: false, displayOrder: 3, preparationTime: 4, categoryId: CATEGORY.COFFEE },
  { name: 'Mocha', description: 'Espresso with chocolate and steamed milk.', price: 189.0, discountedPrice: 169.0, imageUrl: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=800', isVeg: true, isFeatured: true, displayOrder: 4, preparationTime: 6, categoryId: CATEGORY.COFFEE },

  // Tea
  { name: 'Masala Tea', description: 'Indian spiced tea.', price: 79.0, discountedPrice: 69.0, imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800', isVeg: true, isFeatured: false, displayOrder: 1, preparationTime: 5, categoryId: CATEGORY.TEA },
  { name: 'Green Tea', description: 'Refreshing green tea.', price: 99.0, discountedPrice: 89.0, imageUrl: 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800', isVeg: true, isFeatured: false, displayOrder: 2, preparationTime: 5, categoryId: CATEGORY.TEA },
  { name: 'Lemon Tea', description: 'Light and zesty lemon tea.', price: 89.0, discountedPrice: 79.0, imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800', isVeg: true, isFeatured: false, displayOrder: 3, preparationTime: 5, categoryId: CATEGORY.TEA },
  { name: 'Ginger Tea', description: 'Warm ginger-infused tea.', price: 89.0, discountedPrice: 79.0, imageUrl: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800', isVeg: true, isFeatured: false, displayOrder: 4, preparationTime: 5, categoryId: CATEGORY.TEA },

  // Breakfast
  { name: 'Pancakes', description: 'Fluffy pancakes.', price: 249.0, discountedPrice: 219.0, imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800', isVeg: true, isFeatured: true, displayOrder: 1, preparationTime: 15, categoryId: CATEGORY.BREAKFAST },
  { name: 'Veg Omelette', description: 'Masala omelette.', price: 199.0, discountedPrice: 179.0, imageUrl: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800', isVeg: false, isFeatured: false, displayOrder: 2, preparationTime: 12, categoryId: CATEGORY.BREAKFAST },
  { name: 'French Toast', description: 'Golden toast with maple syrup.', price: 229.0, discountedPrice: 199.0, imageUrl: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800', isVeg: true, isFeatured: true, displayOrder: 3, preparationTime: 15, categoryId: CATEGORY.BREAKFAST },
  { name: 'Breakfast Burrito', description: 'Eggs, beans and cheese wrapped in a tortilla.', price: 259.0, discountedPrice: 229.0, imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800', isVeg: false, isFeatured: false, displayOrder: 4, preparationTime: 15, categoryId: CATEGORY.BREAKFAST },

  // Desserts
  { name: 'Chocolate Brownie', description: 'Warm brownie.', price: 189.0, discountedPrice: 169.0, imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800', isVeg: true, isFeatured: true, displayOrder: 1, preparationTime: 8, categoryId: CATEGORY.DESSERTS },
  { name: 'Cheesecake', description: 'Creamy cheesecake.', price: 229.0, discountedPrice: 199.0, imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800', isVeg: true, isFeatured: false, displayOrder: 2, preparationTime: 8, categoryId: CATEGORY.DESSERTS },
  { name: 'Ice Cream Sundae', description: 'Vanilla ice cream with chocolate sauce and nuts.', price: 179.0, discountedPrice: 159.0, imageUrl: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800', isVeg: true, isFeatured: true, displayOrder: 3, preparationTime: 6, categoryId: CATEGORY.DESSERTS },
  { name: 'Apple Pie', description: 'Classic baked apple pie with cinnamon.', price: 209.0, discountedPrice: 189.0, imageUrl: 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=800', isVeg: true, isFeatured: false, displayOrder: 4, preparationTime: 8, categoryId: CATEGORY.DESSERTS },
];
export async function seedMenu(dataSource: DataSource) {
  const repo = dataSource.getRepository(MenuItem);

  let inserted = 0;

  for (const item of items) {
    const exists = await repo.exists({
      where: {
        restaurantId: RESTAURANT_ID,
        name: item.name,
      },
    });

    if (exists) {
      console.log(`⏭️  ${item.name} already exists`);
      continue;
    }

    await repo.insert({
      name: item.name,
      description: item.description,
      price: item.price,
      discountedPrice: item.discountedPrice,
      imageUrl: item.imageUrl,
      isAvailable: true,
      isVeg: item.isVeg,
      isFeatured: item.isFeatured,
      isCustomizable: (item as any).isCustomizable ?? true,
      displayOrder: item.displayOrder,
      preparationTime: item.preparationTime,
      restaurantId: RESTAURANT_ID,
      categoryId: item.categoryId,
    });

    inserted++;
    console.log(`✅ Added ${item.name}`);
  }

  console.log(`🎉 Inserted ${inserted} new menu items`);
}