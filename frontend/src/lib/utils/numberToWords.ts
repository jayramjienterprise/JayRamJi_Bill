export function convertNumberToWords(num: number): string {
  if (!num || num === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHelper(n: number): string {
    let str = '';
    if (n >= 100) {
      str += singleDigits[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      str += teenDigits[n - 10] + ' ';
    } else if (n >= 20) {
      str += doubleDigits[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0 && n < 10) {
      str += singleDigits[n] + ' ';
    }
    return str;
  }

  let rounded = Math.round(num);
  let result = '';

  // Crore
  if (rounded >= 10000000) {
    result += convertHelper(Math.floor(rounded / 10000000)) + 'Crore ';
    rounded %= 10000000;
  }
  // Lakh
  if (rounded >= 100000) {
    result += convertHelper(Math.floor(rounded / 100000)) + 'Lakh ';
    rounded %= 100000;
  }
  // Thousand
  if (rounded >= 1000) {
    result += convertHelper(Math.floor(rounded / 1000)) + 'Thousand ';
    rounded %= 1000;
  }
  // Hundreds, Tens & Units
  if (rounded > 0) {
    result += convertHelper(rounded);
  }

  return (result.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}
