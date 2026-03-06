/**
 * @fileoverview Product Entity
 * @description Represents a product in the catalog
 */

import { AggregateRoot } from '../common/aggregate-root.base';
import { UniqueEntityID } from '../common/unique-entity-id';
import { Money } from '../value-objects';
import { SKU } from '../value-objects/sku.value-object';
import { Quantity } from '../value-objects/quantity.value-object';
import { DomainEvent } from '../events/domain-event.base';

/**
 * Props interface for Product entity
 */
interface ProductProps {
  sku: SKU;
  name: string;
  description: string;
  price: Money;
  stock: Quantity;
  categoryId: UniqueEntityID | null;
  isActive: boolean;
  images: ProductImage[];
  attributes: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product image interface
 */
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
}

/**
 * Product Aggregate Root
 * 
 * Represents a product in the e-commerce catalog.
 * Manages product information, pricing, inventory, and images.
 * 
 * @example
 * const product = Product.create({
 *   sku: SKU.create('ELEC-LAPTOP-001'),
 *   name: 'MacBook Pro 14"',
 *   description: 'Apple MacBook Pro with M3 chip',
 *   price: Money.from(1999.99, 'USD'),
 *   initialStock: Quantity.from(50)
 * });
 */
export class Product extends AggregateRoot<ProductProps> {
  /**
   * Gets the product SKU
   */
  get sku(): SKU {
    return this.props.sku;
  }

  /**
   * Gets the product name
   */
  get name(): string {
    return this.props.name;
  }

  /**
   * Gets the product description
   */
  get description(): string {
    return this.props.description;
  }

  /**
   * Gets the product price
   */
  get price(): Money {
    return this.props.price;
  }

  /**
   * Gets the current stock level
   */
  get stock(): Quantity {
    return this.props.stock;
  }

  /**
   * Gets the category ID
   */
  get categoryId(): UniqueEntityID | null {
    return this.props.categoryId;
  }

  /**
   * Checks if the product is active
   */
  get isActive(): boolean {
    return this.props.isActive;
  }

  /**
   * Gets the product images
   */
  get images(): readonly ProductImage[] {
    return this.props.images;
  }

  /**
   * Gets the primary image
   */
  get primaryImage(): ProductImage | null {
    return this.props.images.find(img => img.isPrimary) ?? null;
  }

  /**
   * Gets product attributes
   */
  get attributes(): Record<string, string> {
    return { ...this.props.attributes };
  }

  /**
   * Gets creation timestamp
   */
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Gets last update timestamp
   */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Creates a new Product
   */
  public static create(props: {
    sku: SKU;
    name: string;
    description: string;
    price: Money;
    initialStock: Quantity;
    categoryId?: UniqueEntityID;
    images?: ProductImage[];
    attributes?: Record<string, string>;
  }): Product {
    // Validate
    if (!props.name.trim()) {
      throw new Error('Product name is required');
    }

    if (props.name.length > 200) {
      throw new Error('Product name cannot exceed 200 characters');
    }

    const now = new Date();

    return new Product({
      sku: props.sku,
      name: props.name.trim(),
      description: props.description?.trim() ?? '',
      price: props.price,
      stock: props.initialStock,
      categoryId: props.categoryId ?? null,
      isActive: true,
      images: props.images ?? [],
      attributes: props.attributes ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Creates a Product from persistence data
   */
  public static fromPersistence(props: {
    id: string;
    sku: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    stock: number;
    categoryId: string | null;
    isActive: boolean;
    images: ProductImage[];
    attributes: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
  }): Product {
    return new Product(
      {
        sku: SKU.create(props.sku),
        name: props.name,
        description: props.description,
        price: Money.from(props.price, props.currency),
        stock: Quantity.from(props.stock),
        categoryId: props.categoryId ? UniqueEntityID.from(props.categoryId) : null,
        isActive: props.isActive,
        images: props.images,
        attributes: props.attributes,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      UniqueEntityID.from(props.id)
    );
  }

  /**
   * Updates the product name
   */
  public updateName(name: string): void {
    if (!name.trim()) {
      throw new Error('Product name is required');
    }
    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Updates the product description
   */
  public updateDescription(description: string): void {
    this.props.description = description.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Updates the product price
   */
  public updatePrice(price: Money): void {
    this.props.price = price;
    this.props.updatedAt = new Date();
  }

  /**
   * Checks if the product is available in the requested quantity
   */
  public isAvailable(quantity: Quantity): boolean {
    return this.props.isActive && this.props.stock.canFulfill(quantity);
  }

  /**
   * Reserves stock for an order
   */
  public reserveStock(quantity: Quantity): void {
    if (!this.isAvailable(quantity)) {
      throw new Error(`Insufficient stock for product ${this.props.name}`);
    }
    this.props.stock = this.props.stock.subtract(quantity);
    this.props.updatedAt = new Date();
  }

  /**
   * Releases reserved stock (e.g., for cancelled orders)
   */
  public releaseStock(quantity: Quantity): void {
    this.props.stock = this.props.stock.add(quantity);
    this.props.updatedAt = new Date();
  }

  /**
   * Adds stock (e.g., for inventory replenishment)
   */
  public addStock(quantity: Quantity): void {
    this.props.stock = this.props.stock.add(quantity);
    this.props.updatedAt = new Date();
  }

  /**
   * Activates the product
   */
  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Deactivates the product
   */
  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  /**
   * Assigns the product to a category
   */
  public assignToCategory(categoryId: UniqueEntityID): void {
    this.props.categoryId = categoryId;
    this.props.updatedAt = new Date();
  }

  /**
   * Removes the product from its category
   */
  public removeFromCategory(): void {
    this.props.categoryId = null;
    this.props.updatedAt = new Date();
  }

  /**
   * Adds an image to the product
   */
  public addImage(image: ProductImage): void {
    // If this is the first image, make it primary
    if (this.props.images.length === 0) {
      image.isPrimary = true;
    }
    this.props.images.push(image);
    this.props.images.sort((a, b) => a.order - b.order);
    this.props.updatedAt = new Date();
  }

  /**
   * Removes an image from the product
   */
  public removeImage(imageId: string): void {
    const index = this.props.images.findIndex(img => img.id === imageId);
    if (index !== -1) {
      const wasPrimary = this.props.images[index].isPrimary;
      this.props.images.splice(index, 1);

      // If removed image was primary, make first remaining image primary
      if (wasPrimary && this.props.images.length > 0) {
        this.props.images[0].isPrimary = true;
      }
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Sets an attribute on the product
   */
  public setAttribute(key: string, value: string): void {
    this.props.attributes[key] = value;
    this.props.updatedAt = new Date();
  }

  /**
   * Removes an attribute from the product
   */
  public removeAttribute(key: string): void {
    delete this.props.attributes[key];
    this.props.updatedAt = new Date();
  }

  /**
   * Converts to a plain object for serialization
   */
  public toPrimitives(): {
    id: string;
    sku: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    stock: number;
    categoryId: string | null;
    isActive: boolean;
    images: ProductImage[];
    attributes: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id.value,
      sku: this.sku.value,
      name: this.name,
      description: this.description,
      price: this.price.amount,
      currency: this.price.currency,
      stock: this.stock.value,
      categoryId: this.categoryId?.value ?? null,
      isActive: this.isActive,
      images: [...this.images],
      attributes: this.attributes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
