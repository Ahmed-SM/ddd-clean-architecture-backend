/**
 * @fileoverview Phone Number Value Object
 * @description Represents a validated phone number with formatting
 */

import { ValueObject } from '../common/value-object.base';

/**
 * Props interface for the Phone value object
 */
interface PhoneProps {
  value: string;
  countryCode: string;
}

/**
 * Phone Value Object
 * 
 * Represents a phone number with country code.
 * Provides validation and formatting utilities.
 * 
 * @example
 * const phone = Phone.create('+1 (555) 123-4567');
 * console.log(phone.e164); // '+15551234567'
 * console.log(phone.formatted); // '+1 (555) 123-4567'
 */
export class Phone extends ValueObject<PhoneProps> {
  private static readonly E164_REGEX = /^\+[1-9]\d{1,14}$/;

  /**
   * Gets the E.164 formatted phone number
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Gets the country calling code
   */
  get countryCode(): string {
    return this.props.countryCode;
  }

  /**
   * Gets the national number (without country code)
   */
  get nationalNumber(): string {
    return this.props.value.replace(`+${this.props.countryCode}`, '');
  }

  /**
   * Gets the E.164 format
   */
  get e164(): string {
    return this.props.value;
  }

  /**
   * Creates a Phone from a string
   * @param phone - The phone number string
   * @returns A new Phone instance
   * @throws Error if the phone number is invalid
   */
  public static create(phone: string): Phone {
    // Remove all non-numeric characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      // Assume US number if no country code
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }

    // Validate E.164 format
    if (!Phone.E164_REGEX.test(cleaned)) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }

    // Extract country code (simplified - just takes first 1-3 digits)
    const countryCode = Phone.extractCountryCode(cleaned);

    return new Phone({ value: cleaned, countryCode });
  }

  /**
   * Creates a Phone from a trusted source (skips validation)
   */
  public static fromTrusted(e164: string, countryCode: string): Phone {
    return new Phone({ value: e164, countryCode });
  }

  /**
   * Extracts the country calling code from an E.164 number
   */
  private static extractCountryCode(e164: string): string {
    // Common country codes (simplified)
    const codes = ['1', '44', '86', '91', '81', '49', '33', '55', '61', '7'];
    
    const withoutPlus = e164.substring(1);
    
    for (const code of codes) {
      if (withoutPlus.startsWith(code)) {
        return code;
      }
    }
    
    // Default to first digit
    return withoutPlus.charAt(0);
  }

  /**
   * Checks if a string is a valid phone number
   */
  public static isValid(phone: string): boolean {
    try {
      Phone.create(phone);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Formats the phone number for display
   */
  get formatted(): string {
    const national = this.nationalNumber;
    
    // US formatting
    if (this.props.countryCode === '1' && national.length === 10) {
      return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
    }
    
    // Generic formatting
    if (national.length > 6) {
      return `+${this.props.countryCode} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
    }
    
    return this.props.value;
  }

  /**
   * Gets a masked version for display
   */
  get masked(): string {
    const national = this.nationalNumber;
    const visible = 4;
    const masked = '*'.repeat(national.length - visible) + national.slice(-visible);
    return `+${this.props.countryCode} ${masked}`;
  }

  /**
   * Checks if this is a US phone number
   */
  public isUS(): boolean {
    return this.props.countryCode === '1';
  }

  /**
   * Checks if this is a mobile number (heuristic)
   */
  public isLikelyMobile(): boolean {
    // US mobile numbers typically start with certain patterns
    if (this.props.countryCode === '1') {
      const areaCode = this.nationalNumber.slice(0, 3);
      // This is a simplified check
      return !['800', '888', '877', '866', '855', '844', '833'].includes(areaCode);
    }
    return true;
  }
}
