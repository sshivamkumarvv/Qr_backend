import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateReusableMenuAddons20260927000000
  implements MigrationInterface
{
  name = 'CreateReusableMenuAddons20260927000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'menu_addons',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'price', type: 'numeric', precision: 10, scale: 2 },
          { name: 'isAvailable', type: 'boolean', default: true },
          { name: 'restaurantId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [
          {
            name: 'UQ_menu_addons_restaurant_name',
            columnNames: ['restaurantId', 'name'],
          },
        ],
        indices: [
          {
            name: 'IDX_menu_addons_restaurantId',
            columnNames: ['restaurantId'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_menu_addons_restaurant',
            columnNames: ['restaurantId'],
            referencedTableName: 'restaurants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'menu_item_addons',
        columns: [
          { name: 'menuItemId', type: 'uuid', isPrimary: true },
          { name: 'menuAddonId', type: 'uuid', isPrimary: true },
        ],
        indices: [
          {
            name: 'IDX_menu_item_addons_menuAddonId',
            columnNames: ['menuAddonId'],
          },
        ],
        foreignKeys: [
          {
            name: 'FK_menu_item_addons_menu_item',
            columnNames: ['menuItemId'],
            referencedTableName: 'menu_items',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_menu_item_addons_menu_addon',
            columnNames: ['menuAddonId'],
            referencedTableName: 'menu_addons',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('menu_item_addons', true);
    await queryRunner.dropTable('menu_addons', true);
  }
}
