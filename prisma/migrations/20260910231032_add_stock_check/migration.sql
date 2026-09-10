ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_quantity_non_negative" CHECK ("quantity" >= 0);
