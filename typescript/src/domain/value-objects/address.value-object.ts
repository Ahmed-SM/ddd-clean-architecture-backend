/**
 * @fileoverview Address Value Object
 * @description Represents a physical address with validation
 */

import { ValueObject } from '../common/value-object.base';

/**
 * Props interface for the Address value object
 */
interface AddressProps {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  apartment?: string;
  instructions?: string;
}

/**
 * ISO 3166-1 alpha-2 country codes (subset)
 */
const VALID_COUNTRIES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  AU: 'Australia',
  JP: 'Japan',
  CN: 'China',
  IN: 'India',
  BR: 'Brazil',
  MX: 'Mexico',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  SE: 'Sweden',
  CH: 'Switzerland',
  SG: 'Singapore',
  KR: 'South Korea',
};

/**
 * Address Value Object
 * 
 * Represents a physical shipping or billing address.
 * Validates address components and provides formatting utilities.
 * 
 * @example
 * const address = Address.create({
 *   street: '123 Main St',
 *   city: 'New York',
 *   state: 'NY',
 *   zipCode: '10001',
 *   country: 'US'
 * });
 * console.log(address.formatted); // '123 Main St, New York, NY 10001, US'
 */
export class Address extends ValueObject<AddressProps> {
  private static readonly MAX_STREET_LENGTH = 200;
  private static readonly MAX_CITY_LENGTH = 100;
  private static readonly MAX_STATE_LENGTH = 100;

  /**
   * Gets the street address
   */
  get street(): string {
    return this.props.street;
  }

  /**
   * Gets the apartment/unit number
   */
  get apartment(): string | undefined {
    return this.props.apartment;
  }

  /**
   * Gets the city
   */
  get city(): string {
    return this.props.city;
  }

  /**
   * Gets the state/province
   */
  get state(): string {
    return this.props.state;
  }

  /**
   * Gets the postal/ZIP code
   */
  get zipCode(): string {
    return this.props.zipCode;
  }

  /**
   * Gets the country code
   */
  get country(): string {
    return this.props.country;
  }

  /**
   * Gets delivery instructions
   */
  get instructions(): string | undefined {
    return this.props.instructions;
  }

  /**
   * Gets the country name
   */
  get countryName(): string {
    return VALID_COUNTRIES[this.props.country] ?? this.props.country;
  }

  /**
   * Gets a single-line formatted address
   */
  get formatted(): string {
    const parts = [
      this.props.apartment ? `${this.props.street}, ${this.props.apartment}` : this.props.street,
      `${this.props.city}, ${this.props.state} ${this.props.zipCode}`,
      this.countryName,
    ];
    return parts.join(', ');
  }

  /**
   * Creates a new Address value object
   * @param props - Address properties
   * @returns A new Address instance
   * @throws Error if any field is invalid
   */
  public static create(props: Omit<AddressProps, 'apartment' | 'instructions'> & { apartment?: string; instructions?: string }): Address {
    // Normalize and validate
    const street = props.street.trim();
    const city = props.city.trim();
    const state = props.state.trim();
    const zipCode = props.zipCode.trim().toUpperCase();
    const country = props.country.trim().toUpperCase();
    const apartment = props.apartment?.trim();
    const instructions = props.instructions?.trim();

    // Validate street
    if (!street) {
      throw new Error('Street address is required');
    }
    if (street.length > Address.MAX_STREET_LENGTH) {
      throw new Error(`Street cannot exceed ${Address.MAX_STREET_LENGTH} characters`);
    }

    // Validate city
    if (!city) {
      throw new Error('City is required');
    }
    if (city.length > Address.MAX_CITY_LENGTH) {
      throw new Error(`City cannot exceed ${Address.MAX_CITY_LENGTH} characters`);
    }

    // Validate state
    if (!state) {
      throw new Error('State/province is required');
    }
    if (state.length > Address.MAX_STATE_LENGTH) {
      throw new Error(`State cannot exceed ${Address.MAX_STATE_LENGTH} characters`);
    }

    // Validate zip code
    if (!zipCode) {
      throw new Error('ZIP/postal code is required');
    }

    // Validate country
    if (!country) {
      throw new Error('Country is required');
    }

    return new Address({
      street,
      city,
      state,
      zipCode,
      country,
      apartment,
      instructions,
    });
  }

  /**
   * Checks if this is a US address
   */
  public isUSAddress(): boolean {
    return this.props.country === 'US';
  }

  /**
   * Checks if the address appears to be a PO Box
   */
  public isPOBox(): boolean {
    const poBoxPattern = /^p\.?o\.?\s*box/i;
    return poBoxPattern.test(this.props.street);
  }

  /**
   * Gets the address as a multi-line format
   */
  public toMultiLine(): string[] {
    const lines: string[] = [];
    lines.push(this.props.apartment ? `${this.props.street}, ${this.props.apartment}` : this.props.street);
    lines.push(`${this.props.city}, ${this.props.state} ${this.props.zipCode}`);
    lines.push(this.countryName);
    if (this.props.instructions) {
      lines.push(`Instructions: ${this.props.instructions}`);
    }
    return lines;
  }

  /**
   * Converts to a plain object for serialization
   */
  public toPrimitives(): AddressProps {
    return { ...this.props };
  }
}
