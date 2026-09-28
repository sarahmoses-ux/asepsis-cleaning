export const contacts = {
  residential: { name: 'Asepsis Cleaning Services', email: 'asepsiscleaningservices@gmail.com' },
  commercial: { name: 'Asepsis Edmond', email: 'asepsisedmond@gmail.com' },
};
export const locationLabel = 'Location: Oklahoma';
export const phone = '405-549-7722';
export function contactFor(type) {
  return type === 'project' ? contacts.commercial : contacts.residential;
}
