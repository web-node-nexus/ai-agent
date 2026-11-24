-- Point seeded characters at photoreal cover/ref JPGs under /public/characters
update public.characters
set
  cover_url = '/characters/' || slug || '/cover.jpg',
  reference_image_urls = array[
    '/characters/' || slug || '/ref1.jpg',
    '/characters/' || slug || '/ref2.jpg',
    '/characters/' || slug || '/ref3.jpg'
  ],
  updated_at = now()
where slug in ('aanya','riya','meher','naina','arjun','kabir','vihaan','rohan');
