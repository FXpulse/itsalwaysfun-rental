-- =====================================================
-- Update products with REAL image URLs + accurate specs
-- Run in Supabase SQL Editor (one-off after initial seed).
-- =====================================================

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/allsportsarena.png',
  description = 'The ultimate sports-themed bounce house for the competitive kids! Dodge balls, climb walls, and bounce in style.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'all-star-sports-arena';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/carnivalkingdom.png',
  description = 'Step right up! The Carnival Kingdom brings the magic of a carnival to your backyard with bright colors and endless fun.',
  setup_area = '20 x 20 ft',
  actual_size = '18''L x 18''W x 15''H',
  age_group = '3+'
WHERE slug = 'carnival-kingdom';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/digdash.png',
  description = 'Rev up the fun with this construction-themed bounce house! Perfect for little builders who love to dig, dash, and play.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'dig-dash-dozer';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/game-on.png',
  description = 'Game On! This video game themed bounce house is every gamer kid''s dream come to life.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'game-on';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/mega-monster-jump.png',
  description = 'Go big or go home! The Mega Monster Jump is an oversized bounce house built for maximum jumping action.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'mega-monster-jump';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/ninjabounce.png',
  description = 'Train like a ninja! This action-packed bounce house challenges kids with obstacle-style fun.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'ninja-bounce-academy';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/robojump.png',
  description = 'Jump into the future with our robot-themed bounce house! Kids will love the futuristic design.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'robo-jump';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/teapartytime.png',
  description = 'It''s tea time and bounce time! Perfect for little princesses who want elegance AND fun.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'tea-party-time';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/webzone.png',
  description = 'Your friendly neighborhood bounce house! Spider-themed fun for all the little heroes.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'the-web-zone';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/unicorndreamland.png',
  description = 'Enter a magical world with our enchanted unicorn bounce house! Rainbow colors and sparkle everywhere.',
  setup_area = '15 x 15 ft',
  actual_size = '13''L x 13''W x 13''H',
  age_group = '3+'
WHERE slug = 'unicorn-dreamland';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/firefighterstation.png',
  description = 'Calling all heroes! This fire station themed bounce house is perfect for aspiring firefighters.',
  setup_area = '22 x 22 ft',
  actual_size = '16.4''L x 16.4''W x 13.8''H',
  age_group = '3+'
WHERE slug = 'fire-fighter-station';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/blockparty.png',
  description = 'Build, play, and bounce! This colorful block-themed inflatable is perfect for neighborhood gatherings.',
  setup_area = '22 x 22 ft',
  actual_size = '16.4''L x 16.4''W x 13.8''H',
  age_group = '3+'
WHERE slug = 'block-party';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/sunnysmiles.png',
  description = 'Double the slides, double the joy! Sunshine, happy faces, and endless laughter are guaranteed.',
  setup_area = '26 x 19 ft',
  actual_size = '20''L x 13''W x 13''H',
  age_group = '2+'
WHERE slug = 'sunny-smiles-slide';

UPDATE products SET
  image_url = 'https://files.sysers.com/cp/upload/itsalwaysfun/items/med/turbodesert.png',
  description = 'Race through the desert in this thrilling dry slide! Speed, excitement, and desert adventure await.',
  setup_area = '30 x 12 ft',
  actual_size = '25''L x 10''W x 15''H',
  age_group = '3+'
WHERE slug = 'turbo-desert-dash';

-- Verify
SELECT slug, name, price_per_day, image_url FROM products ORDER BY category, name;
