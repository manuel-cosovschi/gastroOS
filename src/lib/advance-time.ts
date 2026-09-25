import { addHours, startOfDay, isBefore } from 'date-fns';
import { DEFAULT_MIN_ADVANCE_HOURS } from './constants';

/**
 * Calcula la fecha mínima de entrega.
 * Toma el máximo entre el valor global y los valores individuales de productos.
 */
export function getMinDeliveryDate(
  globalMinHours: number = DEFAULT_MIN_ADVANCE_HOURS,
  itemAdvanceHours: (number | null)[] = []
): Date {
  const validHours = itemAdvanceHours.filter((h): h is number => h !== null);
  const maxAdvance = Math.max(globalMinHours, ...validHours);

  const now = new Date();
  const minDateTime = addHours(now, maxAdvance);

  // Redondear al inicio del día siguiente
  return startOfDay(addHours(minDateTime, 24));
}

/**
 * Valida que la fecha de entrega cumple con la anticipación mínima.
 */
export function validateDeliveryDate(
  deliveryDate: Date | string,
  globalMinHours: number = DEFAULT_MIN_ADVANCE_HOURS,
  itemAdvanceHours: (number | null)[] = []
): { valid: boolean; minDate: Date; message?: string } {
  const date = typeof deliveryDate === 'string' ? new Date(deliveryDate) : deliveryDate;
  const minDate = getMinDeliveryDate(globalMinHours, itemAdvanceHours);

  if (isBefore(date, minDate)) {
    const validHours = itemAdvanceHours.filter((h): h is number => h !== null);
    const hours = Math.max(globalMinHours, ...validHours);
    return {
      valid: false,
      minDate,
      message: `Para garantizar disponibilidad y correcta organización de producción, los pedidos deben realizarse con un mínimo de ${hours} horas de anticipación.`,
    };
  }

  return { valid: true, minDate };
}

/**
 * Genera un array de fechas deshabilitadas para el date picker.
 * Deshabilita todas las fechas anteriores al mínimo.
 */
export function getDisabledDates(
  globalMinHours: number = DEFAULT_MIN_ADVANCE_HOURS,
  itemAdvanceHours: (number | null)[] = []
): { before: Date } {
  const minDate = getMinDeliveryDate(globalMinHours, itemAdvanceHours);
  return { before: minDate };
}
