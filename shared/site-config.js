export const businessEmail = 'asepsisedmond@gmail.com';
export const contacts = {
  residential: { name: 'Asepsis Cleaning Services', email: businessEmail },
  commercial: { name: 'Asepsis Edmond', email: businessEmail },
};
export const locationLabel = 'Location: Oklahoma';
export const phone = '405-549-7722';
export function contactFor(type) {
  return type === 'project' ? contacts.commercial : contacts.residential;
}
