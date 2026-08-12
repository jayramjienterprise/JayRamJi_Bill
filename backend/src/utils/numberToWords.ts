export function convertNumberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';

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

  let result = '';

  // Crore
  if (num >= 10000000) {
    result += convertHelper(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  // Lakh
  if (num >= 100000) {
    result += convertHelper(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  // Thousand
  if (num >= 1000) {
    result += convertHelper(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  // Hundreds, Tens & Units
  if (num > 0) {
    result += convertHelper(num);
  }

  return (result.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}
