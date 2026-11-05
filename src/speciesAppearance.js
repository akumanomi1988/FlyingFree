// Stylized but species-specific plumage regions. These colors are authored
// once, not allocated or sampled from textures at runtime.
export const BIRD_PLUMAGE=Object.freeze({
  kestrel:      {chest:0xe5d5ae,wing:0xa47b58,tip:0x454a4d,crown:0x8d8e87,iris:0xf0b651,mask:0x373a3c,bill:0x62594b},
  hummingbird:  {chest:0x65b9aa,wing:0x258273,tip:0x234c4b,crown:0x18a89c,iris:0x332a2a,throat:0xca489f,bill:0x343e3c},
  vulture:      {chest:0x98745c,wing:0x7d6655,tip:0x463a33,crown:0xb3a69c,iris:0xb9a57b,bill:0x6b635c},
  swift:        {chest:0x6c7983,wing:0x3d5263,tip:0x253440,crown:0x3d4a54,iris:0x2c2f32,bill:0x45403c},
  albatross:    {chest:0xf1eee7,wing:0xe4e4df,tip:0x343e45,crown:0xf1f1eb,iris:0x333f44,bill:0xdbba83},
  osprey:       {chest:0xf5ead9,wing:0x917457,tip:0x3a342e,crown:0xf7efe4,iris:0xd5b454,mask:0x332e2b,bill:0x42403a},
  owl:          {chest:0xbda182,wing:0x88705b,tip:0x54483e,crown:0x9f7d5a,iris:0xef9b3c,mask:0x624a37,bill:0x665344},
  eagle:        {chest:0x806144,wing:0x624a35,tip:0x372e27,crown:0xb18d59,iris:0xd4a158,bill:0x514636},
  kingfisher:   {chest:0xe59750,wing:0x177fa5,tip:0x174566,crown:0x0c659c,iris:0x343738,throat:0xf1e5cb,bill:0x444344},
  heron:        {chest:0xc8d1cf,wing:0x81929d,tip:0x394850,crown:0x354b5b,iris:0xf0b84a,mask:0x333e49,bill:0xd7a45d},
  gull:         {chest:0xf1f2e9,wing:0xd8dfe1,tip:0x3c4249,crown:0xf1f0e8,iris:0xd9bd58,bill:0xe1ac50},
  swallow:      {chest:0xe6d5ca,wing:0x234d69,tip:0x1b293d,crown:0x244765,iris:0x3b3533,throat:0xb95c47,bill:0x3f403e}
});

export function birdPlumage(id){
  const profile=BIRD_PLUMAGE[id];
  if(!profile)throw new RangeError('Missing species plumage: '+id);
  return profile;
}
