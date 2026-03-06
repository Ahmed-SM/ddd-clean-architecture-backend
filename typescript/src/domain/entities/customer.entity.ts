/**
 * @fileoverview Customer Aggregate Root
 * @description Represents a customer in the system
 */

import { AggregateRoot } from '../common/aggregate-root.base';
import { UniqueEntityID } from '../common/unique-entity-id';
import { Email, Address, Phone } from '../value-objects';

/**
 * Props interface for Customer aggregate
 */
interface CustomerProps {
  userId: UniqueEntityID;
  email: Email;
  firstName: string;
  lastName: string;
  phone: Phone | null;
  addresses: CustomerAddress[];
  isActive: boolean;
  totalOrders: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Customer address with label
 */
export interface CustomerAddress {
  id: string;
  label: string;
  address: Address;
  isDefault: boolean;
  type: 'shipping' | 'billing' | 'both';
}

/**
 * Customer Aggregate Root
 * 
 * Represents a customer in the e-commerce system.
 * Manages customer profile, addresses, and order statistics.
 * 
 * @example
 * const customer = Customer.create({
 *   userId: UniqueEntityID.from('user-123'),
 *   email: Email.create('john@example.com'),
 *   firstName: 'John',
 *   lastName: 'Doe'
 * });
 */
export class Customer extends AggregateRoot<CustomerProps> {
  /**
   * Gets the associated user ID
   */
  get userId(): UniqueEntityID {
    return this.props.userId;
  }

  /**
   * Gets the customer email
   */
  get email(): Email {
    return this.props.email;
  }

  /**
   * Gets the first name
   */
  get firstName(): string {
    return this.props.firstName;
  }

  /**
   * Gets the last name
   */
  get lastName(): string {
    return this.props.lastName;
  }

  /**
   * Gets the full name
   */
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }

  /**
   * Gets the phone number
   */
  get phone(): Phone | null {
    return this.props.phone;
  }

  /**
   * Gets all addresses
   */
  get addresses(): readonly CustomerAddress[] {
    return this.props.addresses;
  }

  /**
   * Checks if the customer is active
   */
  get isActive(): boolean {
    return this.props.isActive;
  }

  /**
   * Gets total order count
   */
  get totalOrders(): number {
    return this.props.totalOrders;
  }

  /**
   * Gets total amount spent
   */
  get totalSpent(): number {
    return this.props.totalSpent;
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
   * Creates a new Customer
   */
  public static create(props: {
    userId: UniqueEntityID;
    email: Email;
    firstName: string;
    lastName: string;
    phone?: Phone;
  }): Customer {
    // Validate
    if (!props.firstName.trim()) {
      throw new Error('First name is required');
    }

    if (!props.lastName.trim()) {
      throw new Error('Last name is required');
    }

    const now = new Date();

    return new Customer({
      userId: props.userId,
      email: props.email,
      firstName: props.firstName.trim(),
      lastName: props.lastName.trim(),
      phone: props.phone ?? null,
      addresses: [],
      isActive: true,
      totalOrders: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Creates a Customer from persistence data
   */
  public static fromPersistence(props: {
    id: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    addresses: CustomerAddress[];
    isActive: boolean;
    totalOrders: number;
    totalSpent: number;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return new Customer(
      {
        userId: UniqueEntityID.from(props.userId),
        email: Email.create(props.email),
        firstName: props.firstName,
        lastName: props.lastName,
        phone: props.phone ? Phone.create(props.phone) : null,
        addresses: props.addresses.map(addr => ({
          ...addr,
          address: Address.create(addr.address),
        })),
        isActive: props.isActive,
        totalOrders: props.totalOrders,
        totalSpent: props.totalSpent,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      UniqueEntityID.from(props.id)
    );
  }

  /**
   * Updates customer name
   */
  public updateName(firstName: string, lastName: string): void {
    if (!firstName.trim()) {
      throw new Error('First name is required');
    }
    if (!lastName.trim()) {
      throw new Error('Last name is required');
    }

    this.props.firstName = firstName.trim();
    this.props.lastName = lastName.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Updates customer email
   */
  public updateEmail(email: Email): void {
    this.props.email = email;
    this.props.updatedAt = new Date();
  }

  /**
   * Updates customer phone
   */
  public updatePhone(phone: Phone | null): void {
    this.props.phone = phone;
    this.props.updatedAt = new Date();
  }

  /**
   * Adds an address
   */
  public addAddress(address: Omit<CustomerAddress, 'id'>): void {
    // If this is the first address, make it default
    if (this.props.addresses.length === 0) {
      address.isDefault = true;
    }

    // If setting as default, remove default from others
    if (address.isDefault) {
      this.props.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    this.props.addresses.push({
      ...address,
      id: UniqueEntityID.generate().value,
    });
    this.props.updatedAt = new Date();
  }

  /**
   * Updates an address
   */
  public updateAddress(addressId: string, updates: Partial<Omit<CustomerAddress, 'id'>>): void {
    const index = this.props.addresses.findIndex(addr => addr.id === addressId);
    if (index === -1) {
      throw new Error(`Address not found: ${addressId}`);
    }

    // If setting as default, remove default from others
    if (updates.isDefault) {
      this.props.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    this.props.addresses[index] = {
      ...this.props.addresses[index],
      ...updates,
    };
    this.props.updatedAt = new Date();
  }

  /**
   * Removes an address
   */
  public removeAddress(addressId: string): void {
    const index = this.props.addresses.findIndex(addr => addr.id === addressId);
    if (index === -1) {
      throw new Error(`Address not found: ${addressId}`);
    }

    const wasDefault = this.props.addresses[index].isDefault;
    this.props.addresses.splice(index, 1);

    // If removed address was default, make first remaining address default
    if (wasDefault && this.props.addresses.length > 0) {
      this.props.addresses[0].isDefault = true;
    }

    this.props.updatedAt = new Date();
  }

  /**
   * Gets the default address
   */
  public getDefaultAddress(): CustomerAddress | null {
    return this.props.addresses.find(addr => addr.isDefault) ?? null;
  }

  /**
   * Gets addresses by type
   */
  public getAddressesByType(type: 'shipping' | 'billing' | 'both'): CustomerAddress[] {
    if (type === 'both') {
      return [...this.props.addresses];
    }
    return this.props.addresses.filter(
      addr => addr.type === type || addr.type === 'both'
    );
  }

  /**
   * Records an order completion (updates statistics)
   */
  public recordOrder(amount: number): void {
    this.props.totalOrders += 1;
    this.props.totalSpent += amount;
    this.props.updatedAt = new Date();
  }

  /**
   * Activates the customer
   */
  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Deactivates the customer
   */
  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  /**
   * Converts to a plain object for serialization
   */
  public toPrimitives(): {
    id: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    addresses: CustomerAddress[];
    isActive: boolean;
    totalOrders: number;
    totalSpent: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id.value,
      userId: this.userId.value,
      email: this.email.value,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      phone: this.phone?.value ?? null,
      addresses: this.addresses.map(addr => ({
        ...addr,
        address: addr.address.toPrimitives(),
      })),
      isActive: this.isActive,
      totalOrders: this.totalOrders,
      totalSpent: this.totalSpent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
