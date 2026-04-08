// Number conversion utilities

function apocopateUno(text: string): string {
  if (text === 'uno') return 'un';
  if (text.endsWith('veintiuno')) return `${text.slice(0, -'veintiuno'.length)}veintiún`;
  if (text.endsWith(' y uno')) return `${text.slice(0, -' y uno'.length)} y un`;
  if (text.endsWith(' uno')) return `${text.slice(0, -' uno'.length)} un`;
  return text;
}

function numberToSpanishBeforeMasculineNoun(num: number): string {
  if (num === 100) return 'cien';
  return apocopateUno(numberToSpanish(num));
}

export interface SpanishNumberBreakdownPart {
  label: string;
  value: number;
  spanish: string;
}

function buildScaleChunk(quantity: number, singular: string, plural: string): string {
  if (quantity === 1) return `un ${singular}`;
  return `${numberToSpanishBeforeMasculineNoun(quantity)} ${plural}`;
}

export function numberToSpanish(num: number): string {
  if (num === 0) return 'cero';
  if (num <= 10) return ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez'][num] ?? '';
  if (num <= 19) return ['once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'][num - 11] ?? '';
  if (num === 20) return 'veinte';
  if (num <= 29) { 
    const ones = ['veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve']; 
    return ones[num - 21] ?? ''; 
  }
  if (num <= 99) { 
    const t = Math.floor(num / 10); 
    const u = num % 10; 
    const tens = ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']; 
    const units = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve']; 
    return u === 0 ? tens[t] ?? '' : `${tens[t] ?? ''} y ${units[u] ?? ''}`; 
  }
  if (num <= 999) { 
    if (num === 100) return 'cien'; 
    const h = Math.floor(num / 100); 
    const hundreds = ['ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos']; 
    const rem = num % 100; 
    return rem === 0 ? hundreds[h-1] ?? '' : `${hundreds[h-1] ?? ''} ${numberToSpanish(rem)}`; 
  }
  if (num <= 999999) { 
    if (num === 1000) return 'mil'; 
    if (num < 2000) return `mil ${numberToSpanish(num - 1000)}`; 
    const thousands = Math.floor(num / 1000); 
    const rem = num % 1000; 
    const thousandsText = `${numberToSpanishBeforeMasculineNoun(thousands)} mil`;
    return rem === 0 ? thousandsText : `${thousandsText} ${numberToSpanish(rem)}`;
  }
  if (num === 1000000000000) return 'un billón';
  if (num <= 999999999999) { 
    const millions = Math.floor(num / 1000000); 
    const rem = num % 1000000; 
    const millionsText = millions === 1 ? 'un millón' : `${numberToSpanishBeforeMasculineNoun(millions)} millones`;
    return rem > 0 ? `${millionsText} ${numberToSpanish(rem)}` : millionsText; 
  }
  return 'demasiado grande';
}

export function getSpanishNumberBreakdown(num: number): SpanishNumberBreakdownPart[] {
  if (!Number.isInteger(num) || num < 0 || num > 1000000000000) return [];
  if (num === 0) {
    return [{ label: 'Whole number', value: 0, spanish: 'cero' }];
  }

  const parts: SpanishNumberBreakdownPart[] = [];
  let remainder = num;

  if (remainder === 1000000000000) {
    parts.push({ label: 'Billón', value: 1000000000000, spanish: 'un billón' });
    return parts;
  }

  if (remainder >= 1000000) {
    const millions = Math.floor(remainder / 1000000);
    parts.push({
      label: 'Millions',
      value: millions * 1000000,
      spanish: buildScaleChunk(millions, 'millón', 'millones'),
    });
    remainder %= 1000000;
  }

  if (remainder >= 1000) {
    const thousands = Math.floor(remainder / 1000);
    parts.push({
      label: 'Thousands',
      value: thousands * 1000,
      spanish: thousands === 1 ? 'mil' : `${numberToSpanishBeforeMasculineNoun(thousands)} mil`,
    });
    remainder %= 1000;
  }

  if (remainder > 0) {
    parts.push({
      label: parts.length === 0 ? 'Whole number' : 'Remainder',
      value: remainder,
      spanish: numberToSpanish(remainder),
    });
  }

  return parts;
}

export function numberToWordsEnglish(num: number): string {
  if (num === 0) return 'zero';
  if (num <= 19) return ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'][num] ?? '';
  if (num <= 99) { 
    const t = Math.floor(num / 10); 
    const u = num % 10; 
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']; 
    const ones = ['','one','two','three','four','five','six','seven','eight','nine'];
    return u === 0 ? tens[t] ?? '' : `${tens[t] ?? ''}-${ones[u] ?? ''}`; 
  }
  if (num <= 999) { 
    const h = Math.floor(num / 100); 
    const rem = num % 100; 
    const ones = ['','one','two','three','four','five','six','seven','eight','nine'];
    return rem === 0 ? `${ones[h] ?? ''} hundred` : `${ones[h] ?? ''} hundred ${numberToWordsEnglish(rem)}`; 
  }
  if (num <= 999999) { 
    const t = Math.floor(num / 1000); 
    const rem = num % 1000; 
    return rem === 0 ? `${numberToWordsEnglish(t)} thousand` : `${numberToWordsEnglish(t)} thousand ${numberToWordsEnglish(rem)}`; 
  }
  if (num <= 999999999) { 
    const m = Math.floor(num / 1000000); 
    const rem = num % 1000000; 
    return rem === 0 ? `${numberToWordsEnglish(m)} million` : `${numberToWordsEnglish(m)} million ${numberToWordsEnglish(rem)}`; 
  }
  if (num <= 999999999999) { 
    const b = Math.floor(num / 1000000000); 
    const rem = num % 1000000000; 
    return rem === 0 ? `${numberToWordsEnglish(b)} billion` : `${numberToWordsEnglish(b)} billion ${numberToWordsEnglish(rem)}`; 
  }
  if (num === 1000000000000) return 'one trillion';
  return 'too large';
}
