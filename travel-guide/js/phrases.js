// Essential travel phrases — Korean → Spanish / Italian / French.
// Country flags help quick visual lookup.

const PHRASES = [
  {
    category: '인사',
    items: [
      { ko: '안녕하세요', es: 'Hola', it: 'Ciao / Salve', fr: 'Bonjour' },
      { ko: '감사합니다', es: 'Gracias', it: 'Grazie', fr: 'Merci' },
      { ko: '죄송합니다', es: 'Perdón / Lo siento', it: 'Mi scusi', fr: 'Pardon' },
      { ko: '안녕히 가세요', es: 'Adiós', it: 'Arrivederci', fr: 'Au revoir' },
      { ko: '네 / 아니요', es: 'Sí / No', it: 'Sì / No', fr: 'Oui / Non' },
    ],
  },
  {
    category: '식당',
    items: [
      { ko: '메뉴 주세요', es: '¿Me trae la carta?', it: 'Il menu, per favore', fr: 'La carte, s\'il vous plaît' },
      { ko: '계산서 주세요', es: 'La cuenta, por favor', it: 'Il conto, per favore', fr: 'L\'addition, s\'il vous plaît' },
      { ko: '추천 메뉴는?', es: '¿Qué me recomienda?', it: 'Cosa consiglia?', fr: 'Que recommandez-vous?' },
      { ko: '맛있어요', es: 'Está delicioso', it: 'È delizioso', fr: 'C\'est délicieux' },
      { ko: '물 주세요 (생수/탄산)', es: 'Agua sin gas / con gas', it: 'Acqua naturale / frizzante', fr: 'Eau plate / gazeuse' },
      { ko: '예약했습니다', es: 'Tengo una reserva', it: 'Ho una prenotazione', fr: 'J\'ai une réservation' },
    ],
  },
  {
    category: '쇼핑',
    items: [
      { ko: '얼마예요?', es: '¿Cuánto cuesta?', it: 'Quanto costa?', fr: 'Combien ça coûte?' },
      { ko: '면세 가능한가요?', es: '¿Tax free, por favor?', it: 'Tax free disponibile?', fr: 'Détaxe possible?' },
      { ko: '카드 결제 되나요?', es: '¿Aceptan tarjeta?', it: 'Accettate carte?', fr: 'Vous acceptez la carte?' },
      { ko: '입어봐도 돼요?', es: '¿Puedo probármelo?', it: 'Posso provarlo?', fr: 'Je peux l\'essayer?' },
      { ko: '구경만 할게요', es: 'Solo estoy mirando', it: 'Sto solo guardando', fr: 'Je regarde seulement' },
    ],
  },
  {
    category: '교통 / 길묻기',
    items: [
      { ko: '~까지 가주세요', es: 'A ___, por favor', it: 'A ___, per favore', fr: 'À ___, s\'il vous plaît' },
      { ko: '여기는 어디예요?', es: '¿Dónde estoy?', it: 'Dove sono?', fr: 'Où suis-je?' },
      { ko: '~는 어디에 있어요?', es: '¿Dónde está ___?', it: 'Dov\'è ___?', fr: 'Où est ___?' },
      { ko: '도와주세요', es: '¿Puede ayudarme?', it: 'Mi può aiutare?', fr: 'Pouvez-vous m\'aider?' },
      { ko: '항구로 가주세요', es: 'Al puerto, por favor', it: 'Al porto, per favore', fr: 'Au port, s\'il vous plaît' },
      { ko: '공항으로 가주세요', es: 'Al aeropuerto', it: 'All\'aeroporto', fr: 'À l\'aéroport' },
    ],
  },
  {
    category: '긴급',
    items: [
      { ko: '도와주세요!', es: '¡Ayuda!', it: 'Aiuto!', fr: 'Au secours!' },
      { ko: '경찰을 불러주세요', es: 'Llame a la policía', it: 'Chiami la polizia', fr: 'Appelez la police' },
      { ko: '병원 / 의사가 필요해요', es: 'Necesito un médico', it: 'Ho bisogno di un medico', fr: 'J\'ai besoin d\'un médecin' },
      { ko: '여권을 잃어버렸어요', es: 'He perdido el pasaporte', it: 'Ho perso il passaporto', fr: 'J\'ai perdu mon passeport' },
      { ko: '소매치기 당했어요', es: 'Me han robado', it: 'Mi hanno rubato', fr: 'On m\'a volé' },
      { ko: '한국대사관에 연락해주세요', es: 'Llame a la embajada de Corea del Sur', it: 'Chiami l\'ambasciata sudcoreana', fr: 'Appelez l\'ambassade de Corée du Sud' },
    ],
  },
  {
    category: '숫자',
    items: [
      { ko: '하나/둘/셋', es: 'uno / dos / tres', it: 'uno / due / tre', fr: 'un / deux / trois' },
      { ko: '열 / 백 / 천', es: 'diez / cien / mil', it: 'dieci / cento / mille', fr: 'dix / cent / mille' },
    ],
  },
];
