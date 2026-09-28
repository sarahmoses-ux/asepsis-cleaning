export const publishingSchedule = { days: 'Mondays & Thursdays', timeZone: 'America/Chicago' };

export function publishedPosts(posts, now = new Date()) {
  return posts.filter(post => post.status === 'approved' && Number.isFinite(Date.parse(post.publishAt)) && Date.parse(post.publishAt) <= now.getTime())
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));
}

export function formatPostDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: publishingSchedule.timeZone }).format(new Date(date));
}

export const galleryPhotos = [
  { id: 'kitchen', src: '/photos/kitchen.jpg', title: 'Room for everyday moments', category: 'Kitchens', alt: 'Bright kitchen with a wood island, white cabinets and clear counters', caption: 'A little inspiration for a kitchen that feels ready for the day.' },
  { id: 'bathroom', src: '/photos/bathroom.jpg', title: 'A quieter kind of clean', category: 'Bathrooms', alt: 'Light bathroom with a freestanding bath and a wide vanity', caption: 'Simple spaces, clear surfaces and a calmer start.' },
  { id: 'living', src: '/photos/living.jpg', title: 'Space to slow down', category: 'Living spaces', alt: 'Sunlit living room with neutral seating, plants and framed artwork', caption: 'A welcoming place to come home to.' },
];

// Only add customer-approved reviews with a real source. Never generate testimonials.
export const reviews = [];
