export const bookingLabels = {
  name: "nameLabel", email: "emailLabel", phone: "phoneLabel",
  occasion: "occasionLabel", date: "dateLabel", flexible: "flexLabel",
  location: "locationLabel", guests: "guestsLabel", budget: "budgetLabel",
  vision: "visionLabel", inspiration: "inspirationLabel",
};
export const isBookingLabel = (id) => Object.values(bookingLabels).includes(id);

export function bookingFieldRequired(id, settings) {
  return settings?.required ?? ["nameLabel", "emailLabel", "occasionLabel"].includes(id);
}

export const content = {};
const t = (id, text) => (content[id] = { type: "text", text });
const l = (id, text, href) => (content[id] = { type: "link", text, href });
const m = (id, src, alt) =>
  (content[id] = { type: "image", src: "/assets/" + src, alt, x: 50, y: 50 });
for (const [id, text] of Object.entries({
  brand: "Events2Luv",
  coverCaption: "From the wedding collection",
  previousPhoto: "Previous photograph",
  nextPhoto: "Next photograph",
  eyebrow: "HUDSON VALLEY EVENT PLANNING",
  heroTitle: "Your moment.",
  heroItalic: "Beautifully planned.",
  heroCopy:
    "Personal planning for weddings, birthdays, and meaningful gatherings. Thoughtful details, with your budget in mind.",
  servicesEye: "CELEBRATIONS, MADE PERSONAL",
  servicesTitle: "For the moments that matter.",
  weddingsTitle: "Weddings",
  birthdaysTitle: "Birthdays",
  gatheringsTitle: "Gatherings",
  weddingsCopy:
    "From your first ideas to the finishing touches, thoughtful support for a day that feels like you.",
  birthdaysCopy:
    "Big milestones and small joys. A personal celebration for the people you love.",
  gatheringsCopy:
    "Social occasions, meetings, and meaningful gatherings, planned with care.",
  galleryEye: "THE CELEBRATION STORIES",
  galleryTitle: "You had to be there.",
  galleryCopy: "The details, the people, and the feeling of being together.",
  storyTitle: "A closer look at celebration.",
  storyIntro:
    "Explore moments from our existing gallery, alongside the way we approach every gathering.",
  sparkTitle: "It starts with you.",
  sparkCopy:
    "Tell us what matters: your people, your priorities, and the feeling you want everyone to take home.",
  detailsTitle: "The little things belong together.",
  detailsCopy:
    "Flowers, place settings, and a thoughtfully arranged room give your celebration its own character.",
  momentTitle: "Make room for the moment.",
  momentCopy:
    "With the details considered, there is space to connect, celebrate, and enjoy being together.",
  detailNote:
    "A thoughtful place setting brings flowers, textures, and small personal touches into one welcoming moment.",
  moreTitle: "Little things. Lasting feelings.",
  galleryNote:
    "Photographs from the existing Events2Luv website. This collection illustrates our approach; individual event stories will be added as details are confirmed.",
  aboutEye: "MEET YOUR PLANNER",
  aboutTitle: "A personal touch, from the start.",
  aboutCopy:
    "Shaniese Sanders founded Events2Luv with a love of bringing people together. Her approach combines personal attention, thoughtful details, and a belief that a beautiful celebration begins with understanding your priorities and budget.",
  aboutLocal:
    "Working with vendors throughout the Hudson Valley, Events2Luv helps bring weddings, birthdays, social gatherings, meetings, and celebrations of life together with care.",
  processTitle: "A thoughtful plan. A beautiful day.",
  step1: "Share your vision",
  step2: "Shape the details",
  step3: "Enjoy your moment",
  ctaTitle: "Let’s plan something lovely.",
  footerCopy:
    "Personal celebrations. Thoughtfully planned in the Hudson Valley.",
  bookingEye: "LET’S PLAN SOMETHING PERSONAL",
  bookingTitle: "Your celebration starts here.",
  bookingCopy:
    "Tell us a little about your event. We’ll help shape the next step.",
  formTitle: "Tell us about your event",
  formIntro: "A few details will help us get started.",
  nameLabel: "Your name",
  emailLabel: "Email address",
  occasionLabel: "Event type",
  dateLabel: "Preferred event date",
  flexLabel: "My date is flexible",
  locationLabel: "Event location",
  guestsLabel: "Estimated guests",
  budgetLabel: "Event budget (optional)",
  visionLabel: "Your vision (optional)",
  namePlaceholder: "First and last name",
  emailPlaceholder: "you@example.com",
  locationPlaceholder: "Venue, town, or still deciding",
  guestsPlaceholder: "Approximate number",
  budgetPlaceholder: "Your comfortable range",
  visionPlaceholder: "What would make this celebration feel like you?",
  submitLabel: "Request a consultation",
  submitNote: "We’ll confirm availability and next steps with you.",
  successTitle: "Your story starts here.",
  successCopy:
    "Your request has been received. We’ll review the details and get in touch. Your event date is not yet reserved.",
  nextEye: "WHAT HAPPENS NEXT",
  next1: "We review your event",
  next2: "We arrange a conversation",
  next3: "We shape your proposal",
  faqTitle: "A little clarity before we begin.",
  faq1: "Which events do you plan?",
  answer1:
    "Weddings, adult and children’s birthdays, social gatherings, meetings, and celebrations of life. Tell us what you have in mind.",
  faq2: "Can you work with my budget?",
  answer2:
    "Your priorities and budget are part of the conversation from the beginning. We’ll discuss the scope before preparing a proposal.",
  faq3: "Where do you work?",
  answer3:
    "Our existing vendor network is in the Hudson Valley. Share your event location so we can discuss what is possible.",
  faq4: "Does submitting a request reserve my date?",
  answer4:
    "No. We will confirm availability and discuss the details before a booking is finalized.",
}))
  t(id, text);
for (const [id, text, href] of [
  ["navServices", "Services", "/services"],
  ["navWork", "Our Work", "/gallery"],
  ["navAbout", "About", "/about"],
  ["navFaq", "FAQs", "/faq"],
  ["navBook", "Plan Your Event", "/booking"],
  ["heroBook", "Plan your celebration", "/booking"],
  ["heroWork", "Explore our work", "/gallery"],
  ["ctaBook", "Start the conversation", "/booking"],
  ["footerEmail", "events2luv@gmail.com", "mailto:events2luv@gmail.com"],
  [
    "storyBook",
    "Bring this feeling to my event",
    "/booking?inspiration=The%20Celebration%20Stories",
  ],
  ["aboutBook", "Let’s talk about your event", "/booking"],
])
  l(id, text, href);
for (const [id, src, alt] of [
  [
    "hero",
    "wedding-couple.webp",
    "A newlywed couple walking together, the wedding dress trailing behind them",
  ],
  ["wedding", "wedding-reception.webp", "Wedding reception table"],
  ["birthday", "birthday-cake.webp", "Birthday celebration details"],
  ["gathering", "banquet-place-setting.webp", "An elegant place setting"],
  ["spark", "wedding-preparation.webp", "Preparing for a celebration"],
  [
    "details",
    "banquet-place-setting.webp",
    "A carefully arranged table setting",
  ],
  [
    "moment",
    "wedding-couple.webp",
    "A wedding moment from the Events2Luv gallery",
  ],
  ["overlap", "banquet-flowers.webp", "Floral arrangement"],
  [
    "founder",
    "founder-shaniese.webp",
    "Shaniese Sanders, founder of Events2Luv",
  ],
  ["bookingPhoto", "legacy-hero.webp", "A welcoming celebration table"],
  ["bookingInset", "birthday-cake.webp", "Birthday cake details"],
])
  m(id, src, alt);
content.hero.y = 30;
content.hero.mobileY = 24;
content.moment.y = 0;
content.moment.mobileY = 0;
content.storyFilm = {
  type: "video",
  src: "/assets/celebration-film.mp4",
  poster: "/assets/legacy-hero.webp",
  captions: "",
  alt: "A silent photo film assembled from photographs on the existing Events2Luv website",
  x: 50,
  y: 50,
};

for (const [id, text] of Object.entries({
  filmTitle: "A few details, in motion.",
  filmNote: "A silent photo film from the existing Events2Luv collection.",
  inspirationLabel: "Inspired by",
  phoneLabel: "Phone (optional)",
  phonePlaceholder: "Your preferred contact number",
  inquiryInvalid:
    "Please check the required fields and try again.",
  inquiryRate: "Please try again later, or email us directly.",
  inquiryFailed:
    "We could not send your request. Please try again or email us directly.",
  privacyNote:
    "We use these details to respond to your event inquiry. Please do not include payment or other sensitive information.",
  menuLabel: "Menu",
  storyEyebrow: "THE CELEBRATION STORY",
  chapterSpark: "The invitation",
  chapterDetails: "The details",
  chapterMoment: "The celebration",
  followDetail: "Follow the detail",
  viewPhoto: "View photograph",
  closePhoto: "Close",
  occasionPrompt: "Choose an occasion",
  occasionWedding: "Wedding",
  occasionBirthday: "Birthday",
  occasionGathering: "Gathering",
  occasionMeeting: "Meeting",
  occasionLife: "Celebration of life",
  occasionOther: "Other",
  sendingLabel: "Sending…",
}))
  t(id, text);
for (const key of ["weddings", "birthdays", "gatherings"])
  l(key + "Link", "Plan this celebration", "/booking?inspiration=" + key);
export const mediaSpecs = {
  wedding: "Landscape 3:2 · recommended 2400 × 1600",
  birthday: "Square 1:1 · recommended 1600 × 1600",
  gathering: "Portrait 4:5 · recommended 1600 × 2000",
  hero: "Landscape 3:2 · recommended 2400 × 1600",
  founder: "Portrait 4:5 · recommended 1600 × 2000",
  spark: "Portrait 4:5 · recommended 1600 × 2000",
  details: "Portrait 4:5 · recommended 1600 × 2000",
  moment: "Portrait 4:5 · recommended 1600 × 2000",
  overlap: "Portrait 3:4 · recommended 1200 × 1600",
  bookingPhoto: "Portrait 4:5 · recommended 1600 × 2000",
  bookingInset: "Square 1:1 · recommended 1200 × 1200",
  storyFilm: "Landscape 16:9 · recommended 1920 × 1080",
};
export const editableIds = Object.keys(content);
