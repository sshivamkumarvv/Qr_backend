import { DataSource } from 'typeorm';
import { Category } from '../../modules/categories/entities/category.entity';
import { RESTAURANT_ID } from './restaurant.seed';

export const CATEGORIES = [
  {
    id: '0112e51d-3ac8-4572-87a0-077ae2d809f9',
    name: 'Coffee',
    slug: 'coffee',
    color: '#8D6E63',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500',
    displayOrder: 1,
  },
  {
    id: '220762d3-0831-4539-8569-4d8757e665bf',
    name: 'Burgers',
    slug: 'burgers',
    color: '#FF7043',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
    displayOrder: 2,
  },
  {
    id: '24852cf5-41d5-4edb-9ee0-7a88db127e08',
    name: 'Tea',
    slug: 'tea',
    color: '#26A69A',
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
    displayOrder: 3,
  },
  {
    id: '4de6b1fa-848d-4a3c-b753-2831f816b2c1',
    name: 'Snacks',
    slug: 'snacks',
    color: '#FFA726',
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500',
    displayOrder: 4,
  },
  {
    id: '532ea23e-af20-418c-8b1f-4681bc242dca',
    name: 'Meals',
    slug: 'meals',
    color: '#EF5350',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500',
    displayOrder: 5,
  },
  {
    id: '86cae9af-ebee-484e-aea0-954ffedc65e1',
    name: 'Breakfast',
    slug: 'breakfast',
    color: '#FFCA28',
    imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=500',
    displayOrder: 6,
  },
  {
    id: 'b96fc9df-fe88-4fd2-8ba6-3208ffcdb8cc',
    name: 'Desserts',
    slug: 'desserts',
    color: '#AB47BC',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500',
    displayOrder: 7,
  },
  {
    id: 'd62d2ffb-7350-4550-be1e-ee471eb41921',
    name: 'Pizza',
    slug: 'pizza',
    color: '#D32F2F',
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500',
    displayOrder: 8,
  },
];

export async function seedCategories(dataSource: DataSource) {
  const repo = dataSource.getRepository(Category);

  for (const cat of CATEGORIES) {
    const existing = await repo.findOne({ where: { id: cat.id } });
    if (existing) {
      console.log(`⏭️  Category ${cat.name} already exists`);
      continue;
    }

    const category = repo.create({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      imageUrl: cat.imageUrl,
      displayOrder: cat.displayOrder,
      isActive: true,
      restaurantId: RESTAURANT_ID,
    });

    await repo.save(category);
    console.log(`✅ Added Category: ${cat.name}`);
  }
}
