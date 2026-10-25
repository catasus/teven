// Ändra här. Ingen hemlig information ska ligga i den här filen (repot kan vara publikt).
window.CONFIG = {
  city: "Årsta holmar",
  lat: 59.299,
  lon: 18.049,
  // Hur många dagar framåt kalendern visar
  daysAhead: 14,
  // Hur ofta sidan hämtar väder och kalender på nytt (minuter)
  refreshMinutes: 15,
  // Högsta antal rader i kalendern längst till vänster (sidan kortar själv så att det ryms)
  calendarRows: 30,
  // Foton av barnen (docs/img/otis.jpg, melker.jpg). På med ägarens godkännande, trots att repot är publikt.
  avatarPhotos: true,
  // Dämpar skärmen med ett mörkt lager: 0 = av. dim gäller dagtid, dimNight kvällstid
  dim: 0.25,
  dimNight: 0.1,
  // Kvällsläge (mörk variant) från och med klockan nightFrom till klockan nightTo
  nightFrom: 19,
  nightTo: 7,
  // Gympakläder: veckodagar (0 = söndag, 1 = måndag ... 5 = fredag), bara på skoldagar
  gym: { Otis: [1, 2, 5], Melker: [1, 2] },
  // Läsåret 2026/27: terminer (första och sista dag) och dagar utan skola. Datum som "ÅÅÅÅ-MM-DD".
  schoolTerms: [["2026-08-17", "2026-12-18"], ["2027-01-11", "2027-06-11"]],
  noSchool: [
    ["2026-10-26", "2026-10-30"], // Höstlov, vecka 44
    ["2027-03-01", "2027-03-05"], // Sportlov, vecka 9
    ["2027-03-26", "2027-03-26"], // Långfredag
    ["2027-03-29", "2027-04-02"], // Annandag påsk och påsklov, vecka 13
    ["2027-05-06", "2027-05-07"]  // Kristi himmelsfärd och klämdag
  ]
};
