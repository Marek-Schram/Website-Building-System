// Shared industry classification + feature detection — the single source of truth for "what business is
// this" and "what does its current site already have." Used by packages/opportunities (weak-point reports),
// packages/parity (capture + parity-check), and packages/demo-gen (batch demo generation) — previously each
// had its own independent copy of this logic (opportunities.mjs's detectFeatures/guessIndustry, capture.mjs's
// detect(), parity-check.mjs's inline detect()), which drifted out of sync. Zero imports of its own, pure.
// Strips <style>/<script> BLOCK CONTENTS first, not just their surrounding tags — confirmed a real
// false positive without this (2026-08-18): a Wix mobile-nav CSS custom property "var(--menu-direction)"
// leaked into the "visible text" used for industry classification and satisfied a naive `menu` substring
// check, misclassifying a roofing company as a restaurant. Any keyword collision with CSS class/variable
// names or inline JS is the same underlying risk — this fixes the whole class of bug, not just this one word.
const strip = s => (s || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const metaContent = (h, name) => { const m = h.match(new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, 'i')); return m ? m[1] : null; };

// ---- Feature detection ----
export function detectFeatures(html) {
  const h = html.toLowerCase(); const f = new Set(); const has = (...k) => k.some(x => h.includes(x));
  if (/<form\b/i.test(html)) f.add('contact-form');
  if (/href\s*=\s*["']tel:/i.test(html)) f.add('click-to-call');
  if (has('maps.google', 'google.com/maps', 'maps.googleapis')) f.add('map');
  if (has('instagram.com', 'facebook.com', 'youtube.com', 'tiktok.com')) f.add('social');
  if (has('toasttab', 'chownow', 'gloriafood', 'ontabee', 'order online', 'squareup.com/order', '/order')) f.add('online-ordering');
  if (has('opentable', 'resy.com', 'exploretock', 'reservation')) f.add('reservations');
  if (has('calendly', 'simplybook', 'acuity', 'appointments', 'book now', 'book appointment', 'schedule')) f.add('booking');
  if (has('menu') && (has('$') || /class\s*=\s*["'][^"']*menu/i.test(html))) f.add('menu');
  if (has('snipcart', 'add to cart', 'shopify', 'woocommerce', '/cart', 'shop now')) f.add('store');
  if (has('stripe', 'checkout', 'buy now', 'paypal', 'lemonsqueezy', 'paddle')) f.add('payments');
  if (has('mailchimp', 'brevo', 'newsletter', 'subscribe', 'emailoctopus')) f.add('newsletter');
  if (has('wa.me', 'whatsapp')) f.add('whatsapp');
  if (has('tawk.to', 'crisp.chat', 'intercom', 'livechat')) f.add('live-chat');
  if ((html.match(/<img\b/gi) || []).length >= 6 || has('gallery', 'lightbox')) f.add('gallery');
  if (has('faq', 'frequently asked')) f.add('faq');
  if (has('review', 'testimonial', '★', '⭐', 'stars')) f.add('reviews');
  return f;
}

// What each industry SHOULD have (mirrors add-ons recommendations). id → why it matters.
export const SHOULD_HAVE = {
  restaurant: [['online-ordering', 'Take orders directly and keep the 15–30% DoorDash/Uber Eats charges — often $15k–$30k/yr on $100k delivery.'], ['menu', 'A real HTML menu (not a PDF) ranks on Google and works on phones; PDFs lose customers.'], ['reservations', 'Let guests book a table 24/7 and fill seats.'], ['map', 'Make it one tap to find you.'], ['reviews', 'Social proof drives choice between two restaurants.'], ['click-to-call', 'Most diners call from a phone.']],
  cafe: [['online-ordering', 'Mobile order-ahead grows ticket size and skips the line.'], ['menu', 'HTML menu ranks and reads on phones.'], ['map', 'One-tap directions.'], ['social', 'Cafes live on Instagram.']],
  bakery: [['online-ordering', 'Take custom cake / pre-orders online.'], ['menu', 'Showcase items with prices.'], ['gallery', 'Photos of the goods sell them.'], ['reviews', 'Trust for special orders.']],
  salon: [['booking', '~40% of bookings happen after hours; 24/7 self-booking cuts no-shows 30–50%.'], ['gallery', 'Before/after photos are the #1 salon selling tool.'], ['reviews', 'Trust for a new stylist.'], ['social', 'Instagram is the salon portfolio.']],
  barber: [['booking', 'Let clients book without calling; fill the chair.'], ['reviews', 'Trust for a first cut.'], ['click-to-call', 'Quick calls for walk-ins.']],
  dentist: [['booking', 'Online appointment requests capture patients after hours.'], ['reviews', 'Trust is everything in healthcare.'], ['faq', 'Answer insurance/first-visit questions and deflect calls.'], ['contact-form', 'New-patient intake.']],
  gym: [['booking', 'Class/trial sign-ups online.'], ['gallery', 'Show the space and results.'], ['newsletter', 'Retention and challenges.'], ['social', 'Community lives on social.']],
  plumber: [['click-to-call', 'Emergencies mean instant calls — a sticky call button converts.'], ['contact-form', 'Capture quote requests 24/7.'], ['reviews', 'Trust for letting someone into your home.'], ['faq', 'Answer "do you do X" and reduce time-wasters.']],
  electrician: [['click-to-call', 'Fast calls for urgent work.'], ['contact-form', 'Quote requests.'], ['reviews', 'Trust + licensing signals.']],
  roofing: [['gallery', 'Before/after roof photos are the #1 trust builder for a big-ticket home project.'], ['click-to-call', 'Storm/leak damage means urgency — a sticky call button converts.'], ['reviews', 'Trust for a large, infrequent home purchase.'], ['contact-form', 'Capture free-estimate requests 24/7.']],
  hvac: [['click-to-call', 'No heat/AC is an emergency — instant calls convert.'], ['booking', 'Online tune-up/maintenance scheduling fills the slow season.'], ['reviews', 'Trust for letting someone work on your home systems.'], ['contact-form', 'Capture quote requests 24/7.']],
  landscaping: [['gallery', 'A portfolio of real yards/projects is the #1 selling tool.'], ['contact-form', 'Capture quote requests 24/7.'], ['reviews', 'Trust for recurring home access.'], ['booking', 'Seasonal scheduling (spring cleanup, mowing routes) online.']],
  painters: [['gallery', 'Before/after photos are the #1 selling tool for a paint job.'], ['contact-form', 'Capture free-estimate requests 24/7.'], ['reviews', 'Trust for a large, infrequent home purchase.'], ['click-to-call', 'Quick calls for quote requests.']],
  lawyer: [['contact-form', 'Confidential intake form.'], ['booking', 'Free-consultation scheduling.'], ['faq', 'Answer practice-area questions.'], ['reviews', 'Case-result social proof.']],
  cleaning: [['booking', 'Instant quote/booking wins the job.'], ['reviews', 'Trust for home access.'], ['contact-form', 'Quote requests.']],
  autorepair: [['booking', 'Appointment requests online.'], ['reviews', 'Trust for fair pricing.'], ['map', 'Find the shop.'], ['click-to-call', 'Quick calls.']],
  retail: [['store', 'Sell online, not just in person.'], ['payments', 'Take payment on the site.'], ['gallery', 'Product photos.'], ['newsletter', 'Repeat sales.']],
  hotel: [['booking', 'A direct "Book Now" on your own site avoids the 15–25% commission Airbnb/Booking.com/Expedia take on every OTA booking.'], ['gallery', 'Room and property photos are the #1 driver of a booking decision.'], ['reviews', 'Travelers check reviews before booking a stay — none visible costs bookings.'], ['map', 'One-tap directions help guests actually arrive.']],
  hostel: [['booking', 'Direct bookings skip the OTA commission most hostels rely on Hostelworld/Booking.com for.'], ['reviews', 'Younger travelers lean heavily on reviews before booking a bed.'], ['gallery', 'Photos of the common areas and rooms sell the stay.'], ['social', 'Hostel guests check social before booking.']],
  cabin: [['booking', 'A direct "Book Now" avoids OTA commission on Airbnb/Vrbo.'], ['gallery', 'Photos of the cabin, view, and amenities sell the stay.'], ['reviews', 'Trust before booking a remote property.'], ['map', 'Guests need clear directions to find rural properties.']],
  bedandbreakfast: [['booking', 'Direct bookings avoid OTA commission and let you manage the relationship.'], ['gallery', 'Room and breakfast photos are the top decision driver.'], ['reviews', 'Trust matters for a personal, small-scale stay.'], ['contact-form', 'Guests often ask about pets, diet, or arrival time before booking.']],
  vacationrental: [['booking', 'A direct "Book Now" avoids the 15–25% commission Airbnb/Vrbo take on every booking.'], ['gallery', 'Photos of the property, view, and amenities sell the stay.'], ['reviews', 'Travelers check reviews before booking a rental.'], ['map', 'Guests need directions to find the property.']],
  default: [['contact-form', 'A way to capture leads 24/7.'], ['map', 'One-tap directions.'], ['reviews', 'Social proof to win trust.'], ['click-to-call', 'Easy phone contact.'], ['social', 'Where customers check you out.']],
};

export function guessIndustry(html, override) {
  if (override) return override.toLowerCase();
  const h = strip(html).toLowerCase() + ' ' + (metaContent(html, 'description') || '').toLowerCase();
  const has = (...k) => k.some(x => h.includes(x));
  // Deliberately does NOT trigger on bare 'menu' — confirmed TWO independent real-world false positives
  // on a real roofing site (2026-08-18): a Wix CSS custom property (`var(--menu-direction)`, fixed by
  // stripping <style>/<script> contents above) and, even after that fix, Wix's own generic accessibility
  // boilerplate text ("use tab to navigate through the menu items" — referring to the NAV menu). Ambiguous
  // between "food menu" and "navigation menu" with no reliable way to disambiguate from keywords alone, so
  // it's dropped as a signal; the other four words below are specific enough to stand alone.
  if (has('restaurant', 'dine', 'reservation', 'entree', 'appetizer')) return 'restaurant';
  if (has('espresso', 'latte', 'coffee shop', 'cafe')) return 'cafe';
  if (has('bakery', 'pastry', 'cakes')) return 'bakery';
  if (has('salon', 'hair', 'stylist', 'balayage', 'blowout')) return 'salon';
  if (has('barber', 'fade', 'beard trim')) return 'barber';
  if (has('dentist', 'dental', 'orthodont', 'teeth')) return 'dentist';
  if (has('gym', 'fitness', 'personal training', 'crossfit')) return 'gym';
  if (has('roof', 'shingle', 'gutter', 're-roof', 'reroof')) return 'roofing';
  if (has('hvac', 'furnace', 'air conditioning', 'heating and cooling', 'a/c repair', 'ac repair')) return 'hvac';
  if (has('landscap', 'lawn care', 'lawn mowing', 'hardscape')) return 'landscaping';
  if (has('paint', 'painting', 'painter')) return 'painters';
  if (has('plumber', 'plumbing', 'drain', 'water heater')) return 'plumber';
  if (has('electrician', 'electrical', 'wiring')) return 'electrician';
  if (has('law firm', 'attorney', 'lawyer', 'legal')) return 'lawyer';
  if (has('cleaning', 'maid', 'janitorial')) return 'cleaning';
  if (has('auto repair', 'mechanic', 'oil change', 'tires')) return 'autorepair';
  if (has('hostel', 'dorm bed', 'shared room')) return 'hostel';
  if (has('bed and breakfast', 'bed & breakfast', 'b&b')) return 'bedandbreakfast';
  if (has('cabin rental', 'cabin', 'chalet')) return 'cabin';
  if (has('vacation rental', 'short-term rental', 'vrbo')) return 'vacationrental';
  if (has('hotel', 'inn', 'lodge', 'resort', 'nightly rate', 'per night', 'check-in', 'check-out')) return 'hotel';
  if (has('shop', 'store', 'boutique', 'buy now', 'cart')) return 'retail';
  return 'default';
}
