export const STAGES = ['lead', 'contacted', 'proposal_sent', 'won', 'delivered', 'invoiced'];
export const STAGE_LABELS = {
  lead: 'Lead', contacted: 'Contacted', proposal_sent: 'Proposal Sent',
  won: 'Won', delivered: 'Delivered', invoiced: 'Invoiced',
};
export const CONTENT_PAGES = ['home', 'about', 'services', 'contact', 'testimonials', 'faq', 'gallery'];
export const CONTENT_PAGE_LABELS = {
  home: 'Home', about: 'About', services: 'Services', contact: 'Contact',
  testimonials: 'Testimonials', faq: 'FAQ', gallery: 'Gallery',
};
export const LIST_CONTENT_PAGES = new Set(['services', 'testimonials', 'faq', 'gallery']);
export const LIST_FIELDS = {
  services: [['name', 'Name'], ['description', 'Description'], ['price', 'Price']],
  testimonials: [['quote', 'Quote'], ['author', 'Author']],
  faq: [['q', 'Question'], ['a', 'Answer']],
  gallery: [['src', 'Image path'], ['alt', 'Alt text']],
};
