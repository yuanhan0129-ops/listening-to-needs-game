export const firstEpisode = {
  id: 'rest-01',
  number: '01',
  category: '休息',
  title: '很累，卻停不下來',
  description: '和虛構角色進行一場日常對話練習。',
  character: {
    name: '予安',
    role: '同事',
    portrait: 'yu-an',
  },
  dialogue: [
    '最近常常忙到很晚。明明今天沒有急件，我還是一直刷新信箱。',
    '我知道自己很累，但一停下來就覺得心裡不安，好像會漏掉什麼。',
    '同事跟我說已經做得夠多了，可是我還是很難真的休息。',
  ],
  emotions: [
    { id: 'anxious', label: '焦慮不安' },
    { id: 'tired', label: '疲憊' },
    { id: 'guilty', label: '內疚' },
    { id: 'uncertain', label: '不確定' },
  ],
  needs: [
    { id: 'rest', label: '休息與空間' },
    { id: 'safety', label: '安心與可預期' },
    { id: 'understanding', label: '被理解' },
    { id: 'choice', label: '自主與選擇' },
  ],
  responses: [
    {
      id: 'reflect',
      title: '先反映線索，再邀請對方多說一點',
      text: '聽起來你很累，也擔心一停下來就會漏掉什麼。現在最讓你掛心的是哪一件？',
      ending: '你這樣說，我才發現自己一直擔心會讓別人失望。謝謝你先聽我說，沒有急著替我下結論。',
      outcome: '予安多說了一點停不下來背後的擔心。這段對話停在「更理解自己在意什麼」。',
    },
    {
      id: 'suggest',
      title: '提出一個小小的休息建議',
      text: '如果先離開桌邊五分鐘，去倒杯水，會不會比較容易開始休息？',
      ending: '聽到五分鐘，我還是有點抗拒。不過先起來倒杯水好像可以，回來再看看信箱。',
      outcome: '予安試著從一個很小的行動開始。疲累和不安還在，但多了一個自己的選項。',
    },
    {
      id: 'offer-choice',
      title: '讓對方選擇接下來想做什麼',
      text: '你現在比較想把擔心的事寫下來，還是先暫停一下？',
      ending: '我想先寫下明天第一件要做的事。知道它有被記下來，我可能比較能離開桌前。',
      outcome: '予安選擇先增加一點可預期感，再決定怎麼休息。',
    },
  ],
};
