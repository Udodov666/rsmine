/** Figma presentation with project-specific content approved by the user. */
/** Real project information; external URLs remain empty until supplied. */
export const projectLinks = {
  github: 'https://github.com/jdankinloh/rsmine-desktop/releases/latest',
  telegram: '',
};
export const faqItems = [
  {
    question: 'Что такое RSMine?',
    answer:
      'RSMine — проект для донатов через Lolzteam, алертов в OBS и управления сообщениями зрителей. На этой странице можно посмотреть интерфейс, послушать примеры голосов и попробовать конструктор алертов.',
  },
  {
    question: 'Нужно ли платить, чтобы попробовать?',
    answer:
      'Демо можно открыть бесплатно. Оно работает с примерами донатов: тестовые сообщения не переводят деньги и не являются настоящими платежами.',
  },
  {
    question: 'Как добавить алерты в OBS?',
    answer:
      'В панели откройте «Подключение OBS» и скопируйте ссылку на оверлей. В OBS добавьте источник «Браузер», вставьте ссылку в поле URL и проверьте отображение тестовым донатом.',
  },
  {
    question: 'Что можно изменить в оформлении алерта?',
    answer:
      'Можно выбрать готовое медиа, загрузить свой файл или указать ссылку, изменить шаблон заголовка, цвет, размер и выравнивание текста. Также доступны скругление, тень, длительность, анимация появления и громкость.',
  },
  {
    question: 'Можно ли показывать разные медиа для разных сумм?',
    answer:
      'Да. Выберите режим «По суммам» и задайте пороги с отдельным медиа для каждого. При донате используется уровень с самым большим порогом, который не превышает сумму доната.',
  },
  {
    question: 'Какие настройки есть у озвучки?',
    answer:
      'В приложении можно выбирать голоса, включать и отключать их и задавать стоимость для зрителей. Озвучка использует Cartesia. Кнопки прослушивания на лендинге воспроизводят готовые записи, а не отправляют запросы на синтез.',
  },
  {
    question: 'Можно ли посмотреть страницу донатов без входа?',
    answer:
      'Да, кнопка «Посмотреть демо-донат» открывает демонстрационную страницу. Вход через Twitch в текущей версии ещё не подключён; лендинг не имитирует успешную авторизацию.',
  },
];
export const voices = [
  [
    {
      name: 'Natalia',
      hint: 'Steady Strategist',
      audio: 'natalia',
      enabled: true,
    },
    {
      name: 'Daria',
      hint: 'Decisive Dispatcher',
      audio: 'daria',
      enabled: true,
    },
    {
      name: 'Tatiana',
      hint: 'Friendly Storyteller',
      audio: 'tatiana',
      enabled: true,
    },
    {
      name: 'Olga',
      hint: 'Confident Saleswoman',
      audio: 'olga',
      enabled: true,
    },
    {
      name: 'Irina',
      hint: 'Poetic Voice',
      audio: 'irina',
      enabled: false,
    },
  ],
  [
    {
      name: 'Sergei',
      hint: 'Steady Supporter',
      audio: 'sergei',
      enabled: true,
    },
    {
      name: 'Alexei',
      hint: 'Articulate Analyst',
      audio: 'alexei',
      enabled: true,
    },
    {
      name: 'Dmitri',
      hint: 'Gentle Voice',
      audio: 'dmitri',
      enabled: false,
    },
  ],
];
export const obsCopy = [
  {
    title: 'скопируйте ссылку',
    description:
      'Откройте подключение OBS в RSMine. Ссылка на ваш оверлей уже там.',
  },
  {
    title: 'добавьте «Браузер»',
    description:
      'В OBS создайте источник «Браузер» и вставьте ссылку в поле URL.',
  },
  {
    title: 'отправьте тест-донат',
    description:
      'Проверьте появление сообщения перед эфиром. Деньги для теста не нужны.',
  },
];
