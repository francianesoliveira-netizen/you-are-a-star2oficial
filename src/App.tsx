import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const T = {
  s:"#F9D1D9", sL:"#FDF0F3", sD:"#F2AABB",
  m:"#838F58", mD:"#5E6840", mL:"#B5C182", mP:"#EEF1E4",
  ink:"#1C1C1E", inkS:"#3A3A3C", inkM:"#8E8E93",
  w:"#FFFFFF", warn:"#E06B6B", warnBg:"#FFF0F0", gold:"#C9A84C",
};

// ─── SAFE STORAGE ────────────────────────────────────────────────────────────
const DB = {
  get(k, d = null) {
    try {
      const v = localStorage.getItem("yas_" + k);
      if (!v) return d;
      const parsed = JSON.parse(v);
      return parsed;
    } catch { 
      console.warn("YAS: corrupted key", k, "— using default");
      return d; 
    }
  },
  set(k, v) { try { localStorage.setItem("yas_" + k, JSON.stringify(v)); } catch(e) { console.warn("YAS: save failed", k, e); } },
  clear() { Object.keys(localStorage).filter(k => k.startsWith("yas_")).forEach(k => localStorage.removeItem(k)); },
  clearAll() { 
    try { DB.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try {
      if ('caches' in window) caches.keys().then(names => names.forEach(n => caches.delete(n)));
    } catch {}
  }
};

// Data local do dispositivo, sem UTC/toISOString, para evitar virar o dia antes no Brasil.
const localDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayKey = () => localDateKey();
const parseLocalDate = (key) => new Date(`${key}T12:00:00`);
const daysSinceLocal = (startKey) => Math.max(0, Math.floor((parseLocalDate(todayKey()) - parseLocalDate(startKey)) / 86400000));
const formatDateBR = (key, opts) => parseLocalDate(key).toLocaleDateString("pt-BR", opts);

// ─── FOOD DB (115 items, TACO/TBCA based) ─────────────────────────────────────
const FOOD_DB = [
  {id:"f1",name:"Arroz branco cozido",cat:"Grãos",cal100:128,p:2.5,c:28.1,f:0.2,unit:"g"},
  {id:"f2",name:"Arroz integral cozido",cat:"Grãos",cal100:124,p:2.6,c:25.8,f:1.0,unit:"g"},
  {id:"f3",name:"Macarrão cozido",cat:"Grãos",cal100:149,p:4.5,c:30.6,f:0.9,unit:"g"},
  {id:"f4",name:"Aveia em flocos",cat:"Grãos",cal100:394,p:13.9,c:67.9,f:8.5,unit:"g"},
  {id:"f5",name:"Pão francês",cat:"Panificação",cal100:300,p:8.0,c:58.6,f:3.1,unit:"g",pg:50,pl:"1 unidade"},
  {id:"f6",name:"Pão integral",cat:"Panificação",cal100:253,p:8.8,c:43.0,f:4.9,unit:"g",pg:25,pl:"1 fatia"},
  {id:"f7",name:"Tapioca",cat:"Grãos",cal100:346,p:0.2,c:85.9,f:0.0,unit:"g"},
  {id:"f8",name:"Granola",cat:"Grãos",cal100:471,p:9.6,c:64.2,f:20.3,unit:"g"},
  {id:"f9",name:"Cuscuz cozido",cat:"Grãos",cal100:112,p:2.5,c:24.0,f:0.7,unit:"g"},
  {id:"f10",name:"Quinoa cozida",cat:"Grãos",cal100:120,p:4.4,c:21.3,f:1.9,unit:"g"},
  {id:"f11",name:"Feijão carioca cozido",cat:"Leguminosas",cal100:76,p:4.8,c:13.6,f:0.5,unit:"g"},
  {id:"f12",name:"Feijão preto cozido",cat:"Leguminosas",cal100:77,p:4.5,c:14.0,f:0.5,unit:"g"},
  {id:"f13",name:"Lentilha cozida",cat:"Leguminosas",cal100:93,p:6.3,c:16.3,f:0.4,unit:"g"},
  {id:"f14",name:"Grão-de-bico cozido",cat:"Leguminosas",cal100:164,p:8.9,c:27.4,f:2.6,unit:"g"},
  {id:"f15",name:"Soja cozida",cat:"Leguminosas",cal100:141,p:14.6,c:11.5,f:6.4,unit:"g"},
  {id:"f16",name:"Frango peito grelhado",cat:"Carnes",cal100:159,p:32.0,c:0,f:2.7,unit:"g"},
  {id:"f17",name:"Frango coxa assada",cat:"Carnes",cal100:185,p:26.0,c:0,f:8.8,unit:"g"},
  {id:"f18",name:"Frango desfiado",cat:"Carnes",cal100:163,p:31.5,c:0,f:3.5,unit:"g"},
  {id:"f19",name:"Carne bovina patinho",cat:"Carnes",cal100:219,p:30.7,c:0,f:10.4,unit:"g"},
  {id:"f20",name:"Alcatra grelhada",cat:"Carnes",cal100:211,p:29.4,c:0,f:10.0,unit:"g"},
  {id:"f21",name:"Ovo inteiro cozido",cat:"Ovos",cal100:155,p:12.6,c:1.1,f:11.2,unit:"g",pg:60,pl:"1 unidade"},
  {id:"f22",name:"Clara de ovo",cat:"Ovos",cal100:50,p:10.9,c:0.7,f:0.2,unit:"g",pg:33,pl:"1 clara"},
  {id:"f23",name:"Ovo mexido",cat:"Ovos",cal100:149,p:9.9,c:1.8,f:11.5,unit:"g",pg:90,pl:"2 ovos"},
  {id:"f24",name:"Salmão grelhado",cat:"Peixes",cal100:208,p:28.2,c:0,f:10.5,unit:"g"},
  {id:"f25",name:"Tilápia assada",cat:"Peixes",cal100:128,p:26.2,c:0,f:2.6,unit:"g"},
  {id:"f26",name:"Atum em lata (água)",cat:"Peixes",cal100:130,p:29.0,c:0,f:1.3,unit:"g",pg:170,pl:"1 lata"},
  {id:"f27",name:"Sardinha em lata",cat:"Peixes",cal100:208,p:24.6,c:0,f:11.5,unit:"g"},
  {id:"f28",name:"Camarão cozido",cat:"Peixes",cal100:99,p:20.9,c:0.9,f:1.4,unit:"g"},
  {id:"f29",name:"Leite integral",cat:"Laticínios",cal100:61,p:3.2,c:4.7,f:3.3,unit:"ml"},
  {id:"f30",name:"Leite desnatado",cat:"Laticínios",cal100:35,p:3.4,c:5.0,f:0.1,unit:"ml"},
  {id:"f31",name:"Iogurte grego integral",cat:"Laticínios",cal100:97,p:9.0,c:3.6,f:5.0,unit:"g"},
  {id:"f32",name:"Iogurte natural desnatado",cat:"Laticínios",cal100:49,p:4.1,c:6.8,f:0.2,unit:"g"},
  {id:"f33",name:"Iogurte proteico (skyr)",cat:"Laticínios",cal100:68,p:11.0,c:4.5,f:0.2,unit:"g"},
  {id:"f34",name:"Queijo minas frescal",cat:"Laticínios",cal100:264,p:17.4,c:3.0,f:20.2,unit:"g"},
  {id:"f35",name:"Queijo cottage",cat:"Laticínios",cal100:98,p:11.1,c:3.4,f:4.3,unit:"g"},
  {id:"f36",name:"Queijo muçarela",cat:"Laticínios",cal100:283,p:26.0,c:2.0,f:18.8,unit:"g"},
  {id:"f37",name:"Requeijão cremoso",cat:"Laticínios",cal100:257,p:8.7,c:3.1,f:23.4,unit:"g"},
  {id:"f38",name:"Manteiga",cat:"Laticínios",cal100:726,p:0.9,c:0.1,f:80.8,unit:"g"},
  {id:"f39",name:"Banana prata",cat:"Frutas",cal100:92,p:1.3,c:23.8,f:0.1,unit:"g",pg:100,pl:"1 unidade"},
  {id:"f40",name:"Maçã",cat:"Frutas",cal100:56,p:0.3,c:15.2,f:0.2,unit:"g",pg:150,pl:"1 unidade"},
  {id:"f41",name:"Mamão papaia",cat:"Frutas",cal100:45,p:0.5,c:11.8,f:0.1,unit:"g"},
  {id:"f42",name:"Abacate",cat:"Frutas",cal100:160,p:2.0,c:8.5,f:14.8,unit:"g"},
  {id:"f43",name:"Manga",cat:"Frutas",cal100:64,p:0.9,c:16.7,f:0.2,unit:"g"},
  {id:"f44",name:"Laranja",cat:"Frutas",cal100:46,p:0.9,c:11.5,f:0.1,unit:"g",pg:150,pl:"1 unidade"},
  {id:"f45",name:"Morango",cat:"Frutas",cal100:30,p:0.7,c:7.1,f:0.4,unit:"g"},
  {id:"f46",name:"Melancia",cat:"Frutas",cal100:33,p:0.6,c:8.1,f:0.2,unit:"g"},
  {id:"f47",name:"Uva",cat:"Frutas",cal100:69,p:0.6,c:17.7,f:0.5,unit:"g"},
  {id:"f48",name:"Pera",cat:"Frutas",cal100:55,p:0.5,c:14.5,f:0.1,unit:"g",pg:140,pl:"1 unidade"},
  {id:"f49",name:"Alface",cat:"Vegetais",cal100:11,p:1.3,c:1.7,f:0.2,unit:"g"},
  {id:"f50",name:"Tomate",cat:"Vegetais",cal100:15,p:1.1,c:3.1,f:0.2,unit:"g"},
  {id:"f51",name:"Cenoura crua",cat:"Vegetais",cal100:34,p:1.3,c:7.7,f:0.2,unit:"g"},
  {id:"f52",name:"Brócolis cozido",cat:"Vegetais",cal100:35,p:2.4,c:6.6,f:0.4,unit:"g"},
  {id:"f53",name:"Abobrinha cozida",cat:"Vegetais",cal100:22,p:1.7,c:4.6,f:0.2,unit:"g"},
  {id:"f54",name:"Espinafre cozido",cat:"Vegetais",cal100:28,p:3.0,c:4.3,f:0.4,unit:"g"},
  {id:"f55",name:"Cebola",cat:"Vegetais",cal100:40,p:1.7,c:9.4,f:0.1,unit:"g"},
  {id:"f56",name:"Pepino",cat:"Vegetais",cal100:10,p:0.6,c:2.4,f:0.1,unit:"g"},
  {id:"f57",name:"Batata inglesa cozida",cat:"Tubérculos",cal100:52,p:1.2,c:12.6,f:0.1,unit:"g"},
  {id:"f58",name:"Batata doce cozida",cat:"Tubérculos",cal100:77,p:0.9,c:18.4,f:0.1,unit:"g"},
  {id:"f59",name:"Mandioca cozida",cat:"Tubérculos",cal100:125,p:0.6,c:30.1,f:0.3,unit:"g"},
  {id:"f60",name:"Azeite de oliva",cat:"Gorduras",cal100:884,p:0,c:0,f:100,unit:"ml"},
  {id:"f61",name:"Pasta de amendoim",cat:"Oleaginosas",cal100:588,p:25.1,c:19.6,f:50.4,unit:"g"},
  {id:"f62",name:"Amendoim torrado",cat:"Oleaginosas",cal100:581,p:24.4,c:21.4,f:46.1,unit:"g"},
  {id:"f63",name:"Castanha-do-pará",cat:"Oleaginosas",cal100:656,p:14.3,c:15.1,f:63.5,unit:"g",pg:5,pl:"1 unidade"},
  {id:"f64",name:"Amêndoa",cat:"Oleaginosas",cal100:579,p:21.2,c:21.7,f:49.9,unit:"g"},
  {id:"f65",name:"Chia",cat:"Oleaginosas",cal100:490,p:15.6,c:43.9,f:30.7,unit:"g"},
  {id:"f66",name:"Linhaça",cat:"Oleaginosas",cal100:495,p:19.5,c:28.9,f:34.5,unit:"g"},
  {id:"f67",name:"Whey protein concentrado",cat:"Suplementos",cal100:383,p:80.0,c:7.0,f:6.0,unit:"g",pg:30,pl:"1 scoop"},
  {id:"f68",name:"Whey protein isolado",cat:"Suplementos",cal100:368,p:90.0,c:3.0,f:1.5,unit:"g",pg:30,pl:"1 scoop"},
  {id:"f69",name:"Albumina",cat:"Suplementos",cal100:382,p:83.0,c:3.0,f:1.0,unit:"g"},
  {id:"f70",name:"Café preto",cat:"Bebidas",cal100:2,p:0.3,c:0,f:0,unit:"ml"},
  {id:"f71",name:"Suco de laranja natural",cat:"Bebidas",cal100:42,p:0.7,c:9.9,f:0.1,unit:"ml"},
  {id:"f72",name:"Água de coco",cat:"Bebidas",cal100:19,p:0.2,c:3.7,f:0.2,unit:"ml"},
  {id:"f73",name:"Leite de amêndoa",cat:"Bebidas",cal100:14,p:0.5,c:0.5,f:1.2,unit:"ml"},
  {id:"f74",name:"Chocolate ao leite",cat:"Doces",cal100:535,p:7.7,c:59.3,f:30.0,unit:"g",pg:25,pl:"1 barra pequena"},
  {id:"f75",name:"Chocolate 70% cacau",cat:"Doces",cal100:540,p:10.5,c:33.0,f:40.0,unit:"g",pg:25,pl:"1 barra pequena"},
  {id:"f76",name:"Mel",cat:"Adoçantes",cal100:304,p:0.3,c:82.4,f:0,unit:"g"},
  {id:"f77",name:"Biscoito cream cracker",cat:"Industrializados",cal100:440,p:9.0,c:64.0,f:16.0,unit:"g",pg:25,pl:"5 unidades"},
  {id:"f78",name:"Maionese",cat:"Industrializados",cal100:680,p:1.3,c:2.7,f:74.8,unit:"g"},
  {id:"f79",name:"Big Mac McDonald's",cat:"Fast Food",cal100:257,p:12.7,c:24.1,f:12.6,unit:"g",pg:210,pl:"1 unidade"},
  {id:"f80",name:"Batata frita M",cat:"Fast Food",cal100:327,p:3.4,c:42.0,f:16.0,unit:"g",pg:114,pl:"1 porção"},
  {id:"f81",name:"Pizza fatia",cat:"Fast Food",cal100:266,p:11.0,c:33.0,f:10.0,unit:"g",pg:120,pl:"1 fatia"},
  {id:"f82",name:"Arroz com feijão",cat:"Pratos",cal100:145,p:5.1,c:28.5,f:1.8,unit:"g"},
  {id:"f83",name:"Omelete 2 ovos",cat:"Pratos",cal100:154,p:11.0,c:1.5,f:11.8,unit:"g",pg:130,pl:"1 unidade"},
  {id:"f84",name:"Peito de peru fatiado",cat:"Carnes",cal100:109,p:19.5,c:1.5,f:2.6,unit:"g"},
  {id:"f85",name:"Iogurte grego com frutas",cat:"Laticínios",cal100:110,p:7.0,c:13.0,f:3.0,unit:"g"},
  {id:"f86",name:"Pipoca sem manteiga",cat:"Snacks",cal100:375,p:11.0,c:74.0,f:4.5,unit:"g"},
  {id:"f87",name:"Mix de castanhas",cat:"Snacks",cal100:607,p:16.0,c:20.0,f:54.0,unit:"g"},
  {id:"f88",name:"Açaí puro",cat:"Frutas",cal100:247,p:2.8,c:14.1,f:21.6,unit:"g"},
  {id:"f89",name:"Vitamina de banana",cat:"Bebidas",cal100:68,p:2.8,c:13.0,f:0.9,unit:"ml"},
  {id:"f90",name:"Tapioca com frango",cat:"Pratos",cal100:145,p:14.0,c:18.0,f:2.0,unit:"g",pg:150,pl:"1 unidade"},
  {id:"f91",name:"Barra de proteína",cat:"Suplementos",cal100:380,p:28.0,c:42.0,f:9.0,unit:"g",pg:90,pl:"1 barra"},
  {id:"f92",name:"Bife acebolado",cat:"Carnes",cal100:240,p:28.0,c:3.0,f:13.0,unit:"g"},
  {id:"f93",name:"Carne moída patinho",cat:"Carnes",cal100:212,p:27.0,c:0,f:11.0,unit:"g"},
  {id:"f94",name:"Carne moída acém",cat:"Carnes",cal100:250,p:26.0,c:0,f:16.0,unit:"g"},
  {id:"f95",name:"Filé mignon grelhado",cat:"Carnes",cal100:220,p:32.0,c:0,f:10.0,unit:"g"},
  {id:"f96",name:"Contrafilé grelhado",cat:"Carnes",cal100:278,p:30.0,c:0,f:18.0,unit:"g"},
  {id:"f97",name:"Músculo cozido",cat:"Carnes",cal100:194,p:31.0,c:0,f:7.0,unit:"g"},
  {id:"f98",name:"Lombo suíno assado",cat:"Carnes",cal100:210,p:29.0,c:0,f:10.0,unit:"g"},
  {id:"f99",name:"Pernil suíno assado",cat:"Carnes",cal100:262,p:27.0,c:0,f:17.0,unit:"g"},
  {id:"f100",name:"Linguiça toscana",cat:"Carnes",cal100:296,p:16.0,c:2.0,f:25.0,unit:"g"},
  {id:"f101",name:"Carne seca dessalgada",cat:"Carnes",cal100:313,p:26.0,c:0,f:23.0,unit:"g"},
  {id:"f102",name:"Hambúrguer bovino caseiro",cat:"Carnes",cal100:248,p:18.0,c:2.0,f:18.0,unit:"g",pg:100,pl:"1 unidade"},
  {id:"f103",name:"Frango empanado",cat:"Carnes",cal100:260,p:19.0,c:18.0,f:13.0,unit:"g"},
  {id:"f104",name:"Sobrecoxa de frango assada",cat:"Carnes",cal100:215,p:26.0,c:0,f:12.0,unit:"g"},
  {id:"f105",name:"Peito de frango cozido",cat:"Carnes",cal100:163,p:31.0,c:0,f:3.6,unit:"g"},
  {id:"f106",name:"Salada completa sem molho",cat:"Pratos",cal100:38,p:2.0,c:7.0,f:0.5,unit:"g"},
  {id:"f107",name:"Strogonoff de frango",cat:"Pratos",cal100:180,p:15.0,c:5.0,f:11.0,unit:"g"},
  {id:"f108",name:"Purê de batata",cat:"Pratos",cal100:104,p:2.0,c:16.0,f:4.0,unit:"g"},
  {id:"f109",name:"Legumes cozidos",cat:"Vegetais",cal100:42,p:2.0,c:8.0,f:0.5,unit:"g"},
  {id:"f110",name:"Couve refogada",cat:"Vegetais",cal100:90,p:2.5,c:6.0,f:6.5,unit:"g"},
  {id:"f111",name:"Repolho refogado",cat:"Vegetais",cal100:55,p:1.5,c:8.0,f:2.0,unit:"g"},
  {id:"f112",name:"Beterraba cozida",cat:"Vegetais",cal100:32,p:1.3,c:7.2,f:0.1,unit:"g"},
  {id:"f113",name:"Chuchu cozido",cat:"Vegetais",cal100:19,p:0.7,c:4.8,f:0.1,unit:"g"},
  {id:"f114",name:"Abóbora cozida",cat:"Vegetais",cal100:48,p:1.4,c:10.8,f:0.7,unit:"g"},
  {id:"f115",name:"Crepioca",cat:"Pratos",cal100:170,p:8.0,c:20.0,f:6.0,unit:"g",pg:120,pl:"1 unidade"},
  {id:"f116",name:"Pão de queijo",cat:"Panificação",cal100:330,p:6.0,c:38.0,f:17.0,unit:"g",pg:30,pl:"1 unidade pequena"},
  {id:"f117",name:"Bolo simples",cat:"Doces",cal100:360,p:5.0,c:55.0,f:14.0,unit:"g"},
  {id:"f118",name:"Açaí com banana e granola",cat:"Pratos",cal100:190,p:3.0,c:34.0,f:5.0,unit:"g"},
  {id:"f119",name:"Sorvete massa",cat:"Doces",cal100:210,p:3.5,c:25.0,f:11.0,unit:"g"},
  {id:"f120",name:"Brigadeiro",cat:"Doces",cal100:410,p:6.0,c:55.0,f:18.0,unit:"g",pg:20,pl:"1 unidade"},
  {id:"f121",name:"Refrigerante comum",cat:"Bebidas",cal100:42,p:0,c:10.5,f:0,unit:"ml"},
  {id:"f122",name:"Refrigerante zero",cat:"Bebidas",cal100:1,p:0,c:0,f:0,unit:"ml"},
  {id:"f123",name:"Café com leite",cat:"Bebidas",cal100:35,p:1.8,c:3.0,f:1.8,unit:"ml"},
  {id:"f124",name:"Capuccino",cat:"Bebidas",cal100:75,p:3.0,c:9.0,f:3.0,unit:"ml"},
  {id:"f125",name:"Molho de tomate",cat:"Industrializados",cal100:38,p:1.5,c:7.0,f:0.5,unit:"g"},
  {id:"f126",name:"Ketchup",cat:"Industrializados",cal100:112,p:1.3,c:26.0,f:0.2,unit:"g"},
  {id:"f127",name:"Mostarda",cat:"Industrializados",cal100:66,p:4.0,c:6.0,f:3.5,unit:"g"},
  {id:"f128",name:"Molho barbecue",cat:"Industrializados",cal100:172,p:1.0,c:40.0,f:0.5,unit:"g"},
  {id:"f129",name:"Farofa pronta",cat:"Pratos",cal100:406,p:5.0,c:66.0,f:14.0,unit:"g"},
  {id:"f130",name:"Farinha de mandioca",cat:"Grãos",cal100:365,p:1.6,c:89.0,f:0.3,unit:"g"},
  {id:"f131",name:"Milho cozido",cat:"Grãos",cal100:98,p:3.2,c:20.5,f:1.2,unit:"g"},
  {id:"f132",name:"Ervilha cozida",cat:"Leguminosas",cal100:84,p:5.4,c:15.6,f:0.4,unit:"g"},
  {id:"f133",name:"Palmito",cat:"Vegetais",cal100:28,p:2.5,c:4.6,f:0.4,unit:"g"},
  {id:"f134",name:"Ricota",cat:"Laticínios",cal100:140,p:12.6,c:3.8,f:8.1,unit:"g"},
  {id:"f135",name:"Cream cheese",cat:"Laticínios",cal100:342,p:6.0,c:4.0,f:34.0,unit:"g"},
  {id:"f136",name:"Queijo prato",cat:"Laticínios",cal100:360,p:22.0,c:2.0,f:30.0,unit:"g"},
  {id:"f137",name:"Presunto",cat:"Carnes",cal100:145,p:18.0,c:1.0,f:8.0,unit:"g"},
  {id:"f138",name:"Mortadela",cat:"Carnes",cal100:310,p:13.0,c:4.0,f:27.0,unit:"g"},
  {id:"f139",name:"Banana da terra cozida",cat:"Frutas",cal100:128,p:1.3,c:33.7,f:0.2,unit:"g"},
  {id:"f140",name:"Kiwi",cat:"Frutas",cal100:61,p:1.1,c:14.7,f:0.5,unit:"g"},
  {id:"f141",name:"Abacaxi",cat:"Frutas",cal100:48,p:0.9,c:12.3,f:0.1,unit:"g"},
  {id:"f142",name:"Goiaba",cat:"Frutas",cal100:54,p:1.1,c:13.0,f:0.4,unit:"g"},
  {id:"f143",name:"Melão",cat:"Frutas",cal100:29,p:0.7,c:7.5,f:0.0,unit:"g"},
  {id:"f144",name:"Jiló cozido",cat:"Vegetais",cal100:38,p:1.4,c:8.5,f:0.3,unit:"g"},
  {id:"f145",name:"Berinjela cozida",cat:"Vegetais",cal100:19,p:0.7,c:4.5,f:0.1,unit:"g"},
  {id:"f146",name:"Granola sem açúcar",cat:"Grãos",cal100:420,p:10.0,c:58.0,f:16.0,unit:"g"},
  {id:"f147",name:"Torrada integral",cat:"Panificação",cal100:370,p:11.0,c:67.0,f:6.0,unit:"g",pg:10,pl:"1 unidade"},
  {id:"f148",name:"Wrap integral",cat:"Panificação",cal100:290,p:9.0,c:48.0,f:7.0,unit:"g",pg:60,pl:"1 unidade"},
  {id:"f149",name:"Sopa de legumes",cat:"Pratos",cal100:55,p:2.5,c:9.0,f:1.5,unit:"g"},
  {id:"f150",name:"Canja de galinha",cat:"Pratos",cal100:90,p:7.0,c:11.0,f:2.0,unit:"g"},
];

function searchFoods(q, custom = []) {
  if (!q || q.length < 1) return [];
  try {
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lower = norm(q);
    return [...FOOD_DB, ...custom.map(f => ({...f, isCustom: true}))]
      .filter(f => norm(f.name).includes(lower))
      .slice(0, 12);
  } catch { return []; }
}

function calcNutrition(food, grams) {
  try {
    const g = parseFloat(grams) || 100;
    const factor = g / 100;
    return {
      name: food.name, amount: g, unit: food.unit || "g",
      calories: Math.round((food.cal100 || 0) * factor),
      protein: Math.round((food.p || 0) * factor * 10) / 10,
      carbs: Math.round((food.c || 0) * factor * 10) / 10,
      fat: Math.round((food.f || 0) * factor * 10) / 10,
    };
  } catch { return { name: food.name, amount: 100, unit: "g", calories: 0, protein: 0, carbs: 0, fat: 0 }; }
}


function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function calculateFitnessTargets(raw) {
  try {
    const age = Number(raw?.age) || 26;
    const sex = raw?.sex || "feminino";
    const height = Number(raw?.height) || 174;
    const currentWeight = Number(raw?.currentWeight || raw?.startWeight) || 116;
    const goalWeight = Number(raw?.goalWeight) || Math.max(55, currentWeight - 20);
    const goalDays = Number(raw?.goalDays) || 180;
    const lossKg = Math.max(0, currentWeight - goalWeight);
    const bmr = sex === "masculino"
      ? (10 * currentWeight) + (6.25 * height) - (5 * age) + 5
      : (10 * currentWeight) + (6.25 * height) - (5 * age) - 161;
    const activityFactor = 1.45; // rotina com treino + passos, conservador para não superestimar
    const tdee = Math.round(bmr * activityFactor);
    const requiredDeficit = lossKg > 0 ? Math.round((lossKg * 7700) / goalDays) : 300;
    const safeDeficit = clamp(requiredDeficit, 350, 900);
    const calorieGoal = clamp(Math.round((tdee - safeDeficit) / 50) * 50, 1400, Math.max(1500, tdee - 250));
    const proteinGoal = Math.round(clamp(currentWeight * 1.55, 110, 180));
    const fatGoal = Math.round(clamp((calorieGoal * 0.28) / 9, 45, 75));
    const carbGoal = Math.round(Math.max(80, (calorieGoal - (proteinGoal * 4) - (fatGoal * 9)) / 4));
    const predictedLossPerWeek = Math.round((safeDeficit * 7 / 7700) * 10) / 10;
    const feasibility = requiredDeficit > 1000 ? "agressiva" : requiredDeficit > 750 ? "desafiadora" : "realista";
    return { bmr: Math.round(bmr), tdee, requiredDeficit, safeDeficit, calorieGoal, proteinGoal, carbGoal, fatGoal, predictedLossPerWeek, feasibility };
  } catch {
    return { bmr: 0, tdee: 0, requiredDeficit: 0, safeDeficit: 500, calorieGoal: 1700, proteinGoal: 130, carbGoal: 150, fatGoal: 55, predictedLossPerWeek: 0.5, feasibility: "realista" };
  }
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

function AppProvider({ children }) {
  const [profile, setProfileRaw] = useState(() => DB.get("profile", null));
  const [dailyLogs, setDailyLogsRaw] = useState(() => DB.get("dailyLogs", {}));
  const [weightLog, setWeightLogRaw] = useState(() => DB.get("weightLog", []));
  const [measurements, setMeasurementsRaw] = useState(() => DB.get("measurements", []));
  const [customFoods, setCustomFoodsRaw] = useState(() => DB.get("customFoods", []));
  const [favorites, setFavoritesRaw] = useState(() => DB.get("favorites", []));
  const [savedMeals, setSavedMealsRaw] = useState(() => DB.get("savedMeals", []));
  const [fastingLog, setFastingLogRaw] = useState(() => DB.get("fastingLog", []));
  const [activeFast, setActiveFastRaw] = useState(() => DB.get("activeFast", null));
  const [sugarLog, setSugarLogRaw] = useState(() => DB.get("sugarLog", {}));
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const saveProfile = useCallback((p) => {
    try { setProfileRaw(p); DB.set("profile", p); } catch(e) { console.error("saveProfile failed", e); }
  }, []);

  const getToday = useCallback(() => {
    try {
      const k = todayKey();
      const log = dailyLogs[k];
      if (log && typeof log === "object") return log;
      return { date: k, meals: { breakfast:[], morning_snack:[], lunch:[], afternoon_snack:[], dinner:[], supper:[] }, water:0, steps:0, exercises:[] };
    } catch { return { date: todayKey(), meals: { breakfast:[], morning_snack:[], lunch:[], afternoon_snack:[], dinner:[], supper:[] }, water:0, steps:0, exercises:[] }; }
  }, [dailyLogs]);

  const saveToday = useCallback((data) => {
    try {
      const k = todayKey();
      const updated = { ...dailyLogs, [k]: { ...data, date: k } };
      setDailyLogsRaw(updated);
      DB.set("dailyLogs", updated);
    } catch(e) { console.error("saveToday failed", e); }
  }, [dailyLogs]);

  const addFoodToMeal = useCallback((mealKey, food) => {
    try {
      const today = getToday();
      const entry = { id: Date.now() + "-" + Math.random().toString(36).slice(2), ...food };
      today.meals[mealKey] = [...(today.meals[mealKey] || []), entry];
      saveToday(today);
      showToast("Adicionado! ✓");
    } catch(e) { console.error(e); }
  }, [getToday, saveToday, showToast]);

  const removeFoodFromMeal = useCallback((mealKey, foodId) => {
    try {
      const today = getToday();
      today.meals[mealKey] = (today.meals[mealKey] || []).filter(f => f.id !== foodId);
      saveToday(today);
    } catch(e) { console.error(e); }
  }, [getToday, saveToday]);

  const updateWater = useCallback((waterMl) => {
    try {
      const today = getToday();
      today.water = Math.max(0, (Number(today.water) || 0) + Number(waterMl || 0));
      saveToday(today);
      if (waterMl > 0) showToast("+" + waterMl + "ml 💧");
    } catch(e) { console.error(e); }
  }, [getToday, saveToday, showToast]);

  const updateSteps = useCallback((steps) => {
    try {
      const today = getToday();
      today.steps = Math.max(0, steps);
      saveToday(today);
      showToast("Passos atualizados 👟");
    } catch(e) { console.error(e); }
  }, [getToday, saveToday, showToast]);

  const addExercise = useCallback((exercise) => {
    try {
      const today = getToday();
      today.exercises = [...(today.exercises || []), { id: Date.now(), ...exercise }];
      saveToday(today);
      showToast("Exercício salvo 💪");
    } catch(e) { console.error(e); }
  }, [getToday, saveToday, showToast]);

  const removeExercise = useCallback((id) => {
    try {
      const today = getToday();
      today.exercises = (today.exercises || []).filter(e => e.id !== id);
      saveToday(today);
    } catch(e) { console.error(e); }
  }, [getToday, saveToday]);

  const logWeight = useCallback((kg, date = todayKey()) => {
    try {
      const kgNum = parseFloat(kg);
      if (isNaN(kgNum)) return;
      const entry = { date, kg: kgNum };
      const updated = [...(Array.isArray(weightLog) ? weightLog : []).filter(w => w.date !== date), entry]
        .sort((a, b) => a.date.localeCompare(b.date));
      setWeightLogRaw(updated);
      DB.set("weightLog", updated);
      if (profile) {
        const np = { ...profile, currentWeight: kgNum };
        setProfileRaw(np);
        DB.set("profile", np);
      }
      showToast("Peso registrado ⚖️");
    } catch(e) { console.error(e); }
  }, [weightLog, profile, showToast]);

  const saveMeasurement = useCallback((data) => {
    try {
      const clean = { date: todayKey() };
      Object.entries(data).forEach(([k, v]) => {
        if (k === "date") return;
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0) clean[k] = n;
      });
      const updated = [...(Array.isArray(measurements) ? measurements : []).filter(m => m.date !== clean.date), clean]
        .sort((a, b) => a.date.localeCompare(b.date));
      setMeasurementsRaw(updated);
      DB.set("measurements", updated);
      showToast("Medidas salvas 📏");
    } catch(e) { console.error(e); }
  }, [measurements, showToast]);

  const addCustomFood = useCallback((food) => {
    try {
      const entry = { id: "c" + Date.now(), isCustom: true, ...food };
      const updated = [...(Array.isArray(customFoods) ? customFoods : []), entry];
      setCustomFoodsRaw(updated);
      DB.set("customFoods", updated);
      return entry;
    } catch(e) { console.error(e); return food; }
  }, [customFoods]);

  const toggleFavorite = useCallback((food) => {
    try {
      const key = food.id || food.name;
      const exists = favorites.some(f => (f.id || f.name) === key);
      const updated = exists ? favorites.filter(f => (f.id||f.name) !== key) : [...favorites, food];
      setFavoritesRaw(updated);
      DB.set("favorites", updated);
      showToast(exists ? "Removido dos favoritos" : "Favoritado ⭐", "info");
    } catch(e) { console.error(e); }
  }, [favorites, showToast]);

  const isFavorite = useCallback((food) => {
    try { const key = food.id || food.name; return favorites.some(f => (f.id||f.name) === key); }
    catch { return false; }
  }, [favorites]);

  const saveMealTemplate = useCallback((name, items) => {
    try {
      const entry = { id: Date.now(), name, items, savedAt: todayKey() };
      const updated = [...savedMeals, entry];
      setSavedMealsRaw(updated);
      DB.set("savedMeals", updated);
      showToast("Refeição salva ✓");
    } catch(e) { console.error(e); }
  }, [savedMeals, showToast]);

  const deleteSavedMeal = useCallback((id) => {
    try {
      const updated = savedMeals.filter(m => m.id !== id);
      setSavedMealsRaw(updated);
      DB.set("savedMeals", updated);
    } catch(e) { console.error(e); }
  }, [savedMeals]);

  // ── FASTING ──
  const startFast = useCallback((protocol) => {
    try {
      const fast = { id: Date.now(), protocol, startTime: new Date().toISOString(), targetHours: protocol.fastHours };
      setActiveFastRaw(fast);
      DB.set("activeFast", fast);
      showToast("Jejum iniciado! ⏳");
    } catch(e) { console.error(e); }
  }, [showToast]);

  const endFast = useCallback(() => {
    try {
      if (!activeFast) return;
      const endTime = new Date().toISOString();
      const durationMs = new Date(endTime) - new Date(activeFast.startTime);
      const durationHours = durationMs / 3600000;
      const entry = { ...activeFast, endTime, durationHours: Math.round(durationHours * 10) / 10, success: durationHours >= activeFast.targetHours };
      const updated = [...(Array.isArray(fastingLog) ? fastingLog : []), entry];
      setFastingLogRaw(updated);
      DB.set("fastingLog", updated);
      setActiveFastRaw(null);
      DB.set("activeFast", null);
      showToast(entry.success ? "Jejum concluído! 🎉" : "Jejum encerrado ✓");
    } catch(e) { console.error(e); }
  }, [activeFast, fastingLog, showToast]);

  const deleteFastEntry = useCallback((id) => {
    try {
      const updated = fastingLog.filter(f => f.id !== id);
      setFastingLogRaw(updated);
      DB.set("fastingLog", updated);
    } catch(e) { console.error(e); }
  }, [fastingLog]);


  // ── SUGAR-FREE CHALLENGE ──
  const setSugarFreeDay = useCallback((dateKey = todayKey(), isSugarFree = true) => {
    try {
      const updated = { ...(sugarLog || {}), [dateKey]: { date: dateKey, sugarFree: !!isSugarFree, updatedAt: new Date().toISOString() } };
      setSugarLogRaw(updated);
      DB.set("sugarLog", updated);
      showToast(isSugarFree ? "Dia sem açúcar registrado ✨" : "Dia marcado como com açúcar", "info");
    } catch(e) { console.error(e); }
  }, [sugarLog, showToast]);

  const toggleSugarFreeToday = useCallback(() => {
    try {
      const k = todayKey();
      const current = !!sugarLog?.[k]?.sugarFree;
      setSugarFreeDay(k, !current);
    } catch(e) { console.error(e); }
  }, [sugarLog, setSugarFreeDay]);

  const resetAll = useCallback(() => { try { DB.clearAll(); } catch {} window.location.reload(); }, []);

  const todayData = getToday();
  const allFoods = Object.values(todayData.meals || {}).flat();
  const totals = allFoods.reduce((acc, f) => ({
    calories: acc.calories + (Number(f.calories) || 0),
    protein: acc.protein + (Number(f.protein) || 0),
    carbs: acc.carbs + (Number(f.carbs) || 0),
    fat: acc.fat + (Number(f.fat) || 0),
  }), { calories:0, protein:0, carbs:0, fat:0 });

  const recentWeights = (Array.isArray(weightLog) ? weightLog : []).slice(-14);

  return (
    <AppCtx.Provider value={{
      profile, saveProfile,
      todayData, totals, saveToday, getToday, dailyLogs,
      addFoodToMeal, removeFoodFromMeal,
      updateWater, updateSteps, addExercise, removeExercise,
      logWeight, weightLog: Array.isArray(weightLog) ? weightLog : [], recentWeights,
      measurements: Array.isArray(measurements) ? measurements : [], saveMeasurement,
      customFoods: Array.isArray(customFoods) ? customFoods : [], addCustomFood,
      favorites: Array.isArray(favorites) ? favorites : [], toggleFavorite, isFavorite,
      savedMeals: Array.isArray(savedMeals) ? savedMeals : [], saveMealTemplate, deleteSavedMeal,
      fastingLog: Array.isArray(fastingLog) ? fastingLog : [], activeFast, startFast, endFast, deleteFastEntry,
      sugarLog: sugarLog || {}, setSugarFreeDay, toggleSugarFreeToday,
      resetAll, toast, showToast,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("YAS ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) return (
      <div style={{ minHeight:"100vh", background: "#F5EEF0", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ background:"#fff", borderRadius:24, padding:28, maxWidth:380, width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🌿</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#1C1C1E", marginBottom:8 }}>Algo deu errado</div>
          <div style={{ fontSize:13, color:"#8E8E93", marginBottom:20, lineHeight:1.5 }}>
            Um erro inesperado ocorreu. Seus dados estão seguros.<br />Clique abaixo para recuperar o aplicativo.
          </div>
          <div style={{ fontSize:11, color:"#8E8E93", background:"#FDF0F3", borderRadius:10, padding:10, marginBottom:16, textAlign:"left", wordBreak:"break-all" }}>
            {this.state.error?.message || "Erro desconhecido"}
          </div>
          <button type="button" onClick={() => { try { DB.clearAll(); } catch {} window.location.reload(); }}
            style={{ background:"#838F58", color:"#fff", border:"none", borderRadius:14, padding:"12px 24px", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%", marginBottom:8 }}>
            🔄 Limpar dados e reiniciar
          </button>
          <button type="button" onClick={() => this.setState({ hasError:false })}
            style={{ background:"#EEF1E4", color:"#5E6840", border:"none", borderRadius:14, padding:"10px 24px", fontWeight:700, fontSize:13, cursor:"pointer", width:"100%" }}>
            ← Tentar novamente
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant="primary", small, fullWidth, disabled, style:ex }) {
  const vs = {
    primary:{ background:T.m, color:T.w },
    secondary:{ background:T.mP, color:T.mD },
    danger:{ background:T.warnBg, color:T.warn },
    ghost:{ background:"transparent", color:T.inkM, border:`1.5px solid ${T.s}` },
    pink:{ background:T.s, color:T.inkS },
    dark:{ background:T.mD, color:T.w },
  };
  return (
    <button type="button" disabled={!!disabled} onClick={(e) => { if (!disabled) onClick?.(e); }} style={{
      WebkitTapHighlightColor:"transparent",
      border:"none", borderRadius: small ? 10 : 14,
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight:700, fontSize: small ? 12 : 14,
      fontFamily:"'DM Sans',sans-serif",
      padding: small ? "7px 14px" : "12px 20px",
      opacity: disabled ? 0.45 : 1,
      width: fullWidth ? "100%" : undefined,
      transition:"opacity 0.15s",
      ...vs[variant], ...ex,
    }}>{children}</button>
  );
}

function Field({ label, value, onChange, type="text", placeholder, unit, min, max, step, autoFocus }) {
  const idRef = useRef("field_" + Math.random().toString(36).slice(2));
  const inputRef = useRef(null);
  const displayValue = value == null ? "" : String(value);

  const cleanValue = (raw) => {
    if (raw == null) return "";
    const txt = String(raw);
    if (type === "number") return txt.replace(/[^0-9,.]/g, "").replace(",", ".");
    return txt;
  };

  // iOS PWA fix: use native inputs only. No prompt/readOnly/click interception.
  const inputType = type === "number" ? "text" : type;
  const inputMode = type === "number" ? "decimal" : undefined;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <label htmlFor={idRef.current} style={{ fontSize:12, fontWeight:600, color:T.inkM, letterSpacing:"0.03em" }}>{label}</label>}
      <div style={{ position:"relative" }}>
        <input
          ref={inputRef}
          id={idRef.current}
          type={inputType}
          inputMode={inputMode}
          enterKeyHint="next"
          value={displayValue}
          onChange={e => onChange(cleanValue(e.target.value))}
          onFocus={() => { try { inputRef.current?.scrollIntoView?.({ block:"center", behavior:"smooth" }); } catch {} }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          autoFocus={autoFocus}
          autoComplete="off"
          style={{
            WebkitAppearance:"none", appearance:"none",
            WebkitUserSelect:"text", userSelect:"text", WebkitTouchCallout:"default",
            touchAction:"auto", pointerEvents:"auto", cursor:"text",
            width:"100%", minHeight:48, background:T.sL, border:`1.5px solid ${T.s}`,
            borderRadius:12, padding: unit ? "12px 52px 12px 14px" : "12px 14px",
            fontSize:16, color:T.ink, outline:"none", lineHeight:"22px",
            fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box",
          }}
        />
        {unit && <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:11, color:T.inkM, fontWeight:700, pointerEvents:"none" }}>{unit}</span>}
      </div>
    </div>
  );
}

function Sheet({ open, onClose, title, children }) {
  // iOS PWA FIX: Never use document.body.style.overflow = "hidden" — it prevents
  // the keyboard from opening on iOS PWA. Instead, lock scroll via position:fixed
  // while preserving the scroll position, which is iOS-safe.
  const scrollYRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    scrollYRef.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open]);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    // iOS PWA FIX: Use onPointerDown on backdrop only, not onClick, to avoid
    // capturing taps meant for inputs. The inner sheet stops propagation.
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        style={{ background:T.w, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:430, maxHeight:"92vh", overflowY:"auto", WebkitOverflowScrolling:"touch", paddingBottom:40, animation:"slideUp 0.26s cubic-bezier(.32,0,.67,0)" }}
      >
        <div style={{ position:"sticky", top:0, background:T.w, zIndex:1, padding:"16px 20px 14px", borderBottom:`1px solid ${T.sL}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:T.ink }}>{title}</span>
          <button type="button" onClick={onClose} style={{ background:T.sL, border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontSize:14, color:T.inkM }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Bar({ pct, color, h=6 }) {
  return (
    <div style={{ height:h, borderRadius:h, background:T.s, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:h, background:color, width:`${Math.min(100,Math.max(0,pct))}%`, transition:"width 0.7s ease" }} />
    </div>
  );
}

function Ring({ pct, color, size=64 }) {
  const r=(size-9)/2; const c=2*Math.PI*r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.s} strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct>105?T.warn:color} strokeWidth={8}
        strokeDasharray={`${(Math.min(110,pct)/100)*c} ${c}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray 0.9s ease" }} />
    </svg>
  );
}

function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"22px 12px" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:12, color:T.inkM, lineHeight:1.5 }}>{sub}</div>
    </div>
  );
}

function Toast({ msg, type }) {
  return (
    <div style={{ position:"fixed", bottom:88, left:"50%", transform:"translateX(-50%)", background: type==="info" ? T.inkS : T.mD, color:T.w, padding:"9px 20px", borderRadius:20, fontSize:13, fontWeight:600, zIndex:999, boxShadow:"0 4px 16px rgba(0,0,0,0.18)", animation:"fadeIn 0.2s ease", whiteSpace:"nowrap" }}>{msg}</div>
  );
}

// ─── ADD FOOD SHEET ───────────────────────────────────────────────────────────
function AddFoodSheet({ open, onClose, mealKey, mealLabel }) {
  const { addFoodToMeal, customFoods, addCustomFood, favorites, toggleFavorite, isFavorite, savedMeals } = useApp();
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("100");
  const [cf, setCf] = useState({ name:"", calories:"", protein:"", carbs:"", fat:"", amount:"100" });

  useEffect(() => {
    if (query.length >= 1) setResults(searchFoods(query, customFoods));
    else if (tab === "search") setResults(favorites.slice(0, 10));
    else setResults([]);
  }, [query, customFoods, favorites, tab]);

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(null); setAmount("100"); setCf({ name:"", calories:"", protein:"", carbs:"", fat:"", amount:"100" }); setTab("search"); }
  }, [open]);

  const handleAdd = () => {
    if (!selected || !amount) return;
    addFoodToMeal(mealKey, calcNutrition(selected, amount));
    onClose();
  };

  const handleSaveCustom = () => {
    if (!cf.name || !cf.calories) return;
    const food = { name:cf.name, cal100:+cf.calories, p:+cf.protein||0, c:+cf.carbs||0, f:+cf.fat||0, unit:"g" };
    const saved = addCustomFood(food);
    addFoodToMeal(mealKey, calcNutrition(saved, cf.amount));
    onClose();
  };

  const preview = selected ? calcNutrition(selected, amount) : null;

  return (
    <Sheet open={open} onClose={onClose} title={`Adicionar · ${mealLabel}`}>
      <div style={{ display:"flex", gap:4, background:T.sL, borderRadius:12, padding:3, marginBottom:14 }}>
        {[["search","🔍 Buscar"],["saved","📋 Salvos"],["custom","✏️ Criar"]].map(([id,label]) => (
          <button type="button" key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:tab===id?T.w:"transparent", color:tab===id?T.m:T.inkM, fontWeight:700, fontSize:11, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {tab === "search" && <>
        <Field placeholder="Buscar alimento (ex: frango, arroz)..." value={query} onChange={setQuery} autoFocus />
        {!query && <div style={{ fontSize:11, color:T.inkM, margin:"6px 0 2px" }}>⭐ Favoritos</div>}
        {!selected && (
          <div style={{ marginTop:6, maxHeight:220, overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
            {results.length > 0 ? results.map((food, i) => (
              <button type="button" key={i} onClick={() => { setSelected(food); setAmount(food.pg ? String(food.pg) : "100"); }}
                style={{ background:T.sL, border:"none", borderRadius:10, padding:"10px 12px", textAlign:"left", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.ink }}>{food.name}</div>
                  <div style={{ fontSize:11, color:T.inkM }}>{food.cat} · {food.cal100} kcal/100{food.unit}</div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); toggleFavorite(food); }}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:4 }}>
                  {isFavorite(food) ? "⭐" : "☆"}
                </button>
              </button>
            )) : <div style={{ textAlign:"center", padding:14, color:T.inkM, fontSize:13 }}>
              {query.length >= 1 ? "Sem resultados. Use \"Criar\" para cadastrar." : "Nenhum favorito ainda. Toque ☆ nos alimentos."}
            </div>}
          </div>
        )}
        {selected && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{selected.name}</div>
              <button type="button" onClick={() => setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", color:T.inkM, fontSize:13 }}>← voltar</button>
            </div>
            {selected.pg && (
              <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                <Btn small variant="secondary" onClick={() => setAmount(String(selected.pg))}>{selected.pl}</Btn>
                <Btn small variant="secondary" onClick={() => setAmount("100")}>100g</Btn>
                {[50, 150, 200].map(v => <Btn key={v} small variant="ghost" onClick={() => setAmount(String(v))}>{v}g</Btn>)}
              </div>
            )}
            <Field label="Quantidade" type="number" value={amount} onChange={setAmount} unit={selected.unit||"g"} min="1" max="2000" step="5" />
            {preview && (
              <div style={{ background:T.mP, borderRadius:14, padding:14, marginTop:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6, textAlign:"center" }}>
                  {[["Cal",preview.calories,"kcal"],["Prot",preview.protein,"g"],["Carbs",preview.carbs,"g"],["Gord",preview.fat,"g"]].map(([l,v,u]) => (
                    <div key={l}>
                      <div style={{ fontSize:10, color:T.inkM }}>{l}</div>
                      <div style={{ fontSize:17, fontWeight:700, color:T.mD }}>{v}</div>
                      <div style={{ fontSize:9, color:T.inkM }}>{u}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop:12 }}><Btn fullWidth onClick={handleAdd}>+ Adicionar à refeição</Btn></div>
          </div>
        )}
      </>}

      {tab === "saved" && <div>
        {savedMeals.length === 0
          ? <Empty icon="📋" title="Nenhuma refeição salva" sub="Salve refeições completas no Diário para reusar com um clique." />
          : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {savedMeals.map(meal => (
              <div key={meal.id} style={{ background:T.sL, borderRadius:14, padding:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>{meal.name}</div>
                <div style={{ fontSize:11, color:T.inkM, marginBottom:8 }}>{meal.items.length} itens · {meal.items.reduce((a,f) => a+f.calories,0)} kcal</div>
                <Btn small fullWidth onClick={() => { meal.items.forEach(item => addFoodToMeal(mealKey, { ...item, id: Date.now()+"-"+Math.random().toString(36).slice(2) })); onClose(); }}>Adicionar tudo</Btn>
              </div>
            ))}
          </div>
        }
      </div>}

      {tab === "custom" && <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <Field label="Nome *" value={cf.name} onChange={v => setCf(p=>({...p,name:v}))} placeholder="Ex: Bolo da vovó" autoFocus />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Field label="Calorias /100g *" type="number" value={cf.calories} onChange={v => setCf(p=>({...p,calories:v}))} unit="kcal" />
          <Field label="Proteína /100g" type="number" value={cf.protein} onChange={v => setCf(p=>({...p,protein:v}))} unit="g" />
          <Field label="Carbs /100g" type="number" value={cf.carbs} onChange={v => setCf(p=>({...p,carbs:v}))} unit="g" />
          <Field label="Gordura /100g" type="number" value={cf.fat} onChange={v => setCf(p=>({...p,fat:v}))} unit="g" />
        </div>
        <Field label="Quantidade consumida" type="number" value={cf.amount} onChange={v => setCf(p=>({...p,amount:v}))} unit="g" />
        {cf.name && cf.calories && <div style={{ background:T.mP, borderRadius:12, padding:10, textAlign:"center", fontSize:13, color:T.mD, fontWeight:600 }}>
          ~{Math.round((+cf.calories)*(+cf.amount||100)/100)} kcal · {Math.round((+cf.protein||0)*(+cf.amount||100)/100*10)/10}g prot
        </div>}
        <Btn fullWidth onClick={handleSaveCustom} disabled={!cf.name || !cf.calories}>Salvar e adicionar</Btn>
      </div>}
    </Sheet>
  );
}

// ─── WEIGHT SHEET ─────────────────────────────────────────────────────────────
function WeightSheet({ open, onClose }) {
  const { logWeight, profile } = useApp();
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(todayKey());
  useEffect(() => { if (open) { setKg(profile?.currentWeight ? String(profile.currentWeight) : ""); setDate(todayKey()); } }, [open, profile]);
  return (
    <Sheet open={open} onClose={onClose} title="Registrar Peso">
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <Field label="Peso atual *" type="number" value={kg} onChange={setKg} unit="kg" placeholder="Ex: 112.4" step="0.05" autoFocus />
        <Field label="Data" type="date" value={date} onChange={setDate} />
        <Btn fullWidth onClick={() => { if (kg) { logWeight(kg, date); onClose(); } }} disabled={!kg}>Salvar pesagem</Btn>
      </div>
    </Sheet>
  );
}

// ─── WATER SHEET ──────────────────────────────────────────────────────────────
function WaterSheet({ open, onClose }) {
  const { todayData, updateWater, profile } = useApp();
  const [custom, setCustom] = useState("");
  const cur = todayData.water || 0;
  const goal = profile?.waterGoal || 2500;
  return (
    <Sheet open={open} onClose={onClose} title="💧 Registrar Água">
      <div style={{ textAlign:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:40, fontWeight:700, color:T.m }}>{(cur/1000).toFixed(2).replace(".",",")}L</div>
        <div style={{ fontSize:13, color:T.inkM }}>meta: {(goal/1000).toFixed(1)}L</div>
        <div style={{ margin:"10px auto 0", width:"80%" }}><Bar pct={(cur/goal)*100} color={T.m} h={10} /></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
        {[150,200,250,300,350,500].map(waterAmount => (
          <Btn key={waterAmount} variant="secondary" onClick={() => { updateWater(waterAmount); onClose(); }}>+{waterAmount}ml</Btn>
        ))}
      </div>
      <div style={{ borderTop:`1px solid ${T.sL}`, paddingTop:14 }}>
        <Field label="Valor personalizado" type="number" value={custom} onChange={setCustom} unit="ml" placeholder="Ex: 400" />
        <div style={{ marginTop:10, display:"flex", gap:8 }}>
          <Btn fullWidth variant="ghost" onClick={() => { if (custom) { updateWater(-Math.abs(+custom)); setCustom(""); onClose(); } }}>− Remover</Btn>
          <Btn fullWidth onClick={() => { if (custom) { updateWater(+custom); setCustom(""); onClose(); } }}>+ Adicionar</Btn>
        </div>
      </div>
    </Sheet>
  );
}

// ─── EXERCISE SHEET ───────────────────────────────────────────────────────────
const EX_LIST = [
  {name:"Musculação",cpm:6},{name:"Caminhada",cpm:4},{name:"Corrida",cpm:10},
  {name:"Bicicleta",cpm:8},{name:"Elíptico",cpm:8},{name:"Natação",cpm:9},
  {name:"Pilates",cpm:3},{name:"Yoga",cpm:3},{name:"HIIT",cpm:12},
  {name:"Agachamento",cpm:7},{name:"Supino",cpm:6},{name:"Leg press",cpm:6},
];
function ExerciseSheet({ open, onClose }) {
  const { addExercise } = useApp();
  const [name, setName] = useState(""); const [dur, setDur] = useState(""); const [notes, setNotes] = useState(""); const [picked, setPicked] = useState(null);
  useEffect(() => { if (!open) { setName(""); setDur(""); setNotes(""); setPicked(null); } }, [open]);
  const cpm = picked?.cpm || 5;
  const calEst = dur ? Math.round(cpm * +dur) : 0;
  return (
    <Sheet open={open} onClose={onClose} title="Registrar Exercício">
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
        {EX_LIST.map(ex => (
          <button type="button" key={ex.name} onClick={() => { setPicked(ex); setName(ex.name); }}
            style={{ background:picked?.name===ex.name?T.m:T.sL, color:picked?.name===ex.name?T.w:T.ink, border:"none", borderRadius:10, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>{ex.name}</button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <Field label="Exercício" value={name} onChange={v => { setName(v); setPicked(null); }} placeholder="Ou escreva livremente" />
        <Field label="Duração *" type="number" value={dur} onChange={setDur} unit="min" placeholder="Ex: 45" />
        <Field label="Observações" value={notes} onChange={setNotes} placeholder="Ex: Treino A — pernas" />
        {calEst > 0 && <div style={{ background:T.mP, borderRadius:12, padding:10, textAlign:"center", fontSize:13, color:T.mD, fontWeight:600 }}>~{calEst} kcal estimadas</div>}
        <Btn fullWidth onClick={() => { if (!name||!dur) return; addExercise({name, duration:+dur, calories:calEst, notes}); onClose(); }} disabled={!name||!dur}>Salvar exercício</Btn>
      </div>
    </Sheet>
  );
}

// ─── STEPS SHEET ──────────────────────────────────────────────────────────────
function StepsSheet({ open, onClose }) {
  const { todayData, updateSteps } = useApp();
  const [steps, setSteps] = useState("");
  useEffect(() => { if (open) setSteps(todayData.steps ? String(todayData.steps) : ""); }, [open, todayData.steps]);
  return (
    <Sheet open={open} onClose={onClose} title="👟 Registrar Passos">
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <Field label="Total de passos hoje" type="number" value={steps} onChange={setSteps} unit="passos" placeholder="Ex: 7500" autoFocus />
        <Btn fullWidth onClick={() => { if (steps) { updateSteps(+steps); onClose(); } }} disabled={!steps}>Atualizar</Btn>
      </div>
    </Sheet>
  );
}

// ─── MEASUREMENTS SHEET ───────────────────────────────────────────────────────
const MFIELDS = [
  {k:"waist",l:"Cintura"},{k:"belly",l:"Barriga"},{k:"hip",l:"Quadril"},{k:"bust",l:"Busto"},
  {k:"armR",l:"Braço Dir."},{k:"armL",l:"Braço Esq."},{k:"thighR",l:"Coxa Dir."},{k:"thighL",l:"Coxa Esq."},
];
function MeasSheet({ open, onClose, initial }) {
  const { saveMeasurement } = useApp();
  const [vals, setVals] = useState({});
  useEffect(() => { if (open) setVals(initial ? {...initial} : {}); }, [open, initial]);
  return (
    <Sheet open={open} onClose={onClose} title="📏 Medidas Corporais">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {MFIELDS.map(f => <Field key={f.k} label={f.l} type="number" value={vals[f.k] ? String(vals[f.k]) : ""} onChange={v => setVals(p=>({...p,[f.k]:v}))} unit="cm" placeholder="—" />)}
      </div>
      <div style={{ marginTop:14 }}><Btn fullWidth onClick={() => { saveMeasurement(vals); onClose(); }}>Salvar medidas</Btn></div>
    </Sheet>
  );
}

// ─── SAVE MEAL SHEET ──────────────────────────────────────────────────────────
function SaveMealSheet({ open, onClose, items }) {
  const { saveMealTemplate } = useApp();
  const [name, setName] = useState("");
  useEffect(() => { if (!open) setName(""); }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Salvar Refeição">
      <div style={{ fontSize:13, color:T.inkM, marginBottom:12 }}>{items?.length} itens · {items?.reduce((a,f) => a+f.calories, 0)} kcal</div>
      <Field label="Nome desta refeição" value={name} onChange={setName} placeholder="Ex: Café da manhã padrão" autoFocus />
      <div style={{ marginTop:12 }}><Btn fullWidth onClick={() => { if (name) { saveMealTemplate(name, items); onClose(); } }} disabled={!name}>Salvar</Btn></div>
    </Sheet>
  );
}

// ─── MEAL SECTION ─────────────────────────────────────────────────────────────
const MEAL_META = {
  breakfast:{label:"Café da manhã",icon:"🌅"},
  morning_snack:{label:"Lanche manhã",icon:"🍎"},
  lunch:{label:"Almoço",icon:"🍽️"},
  afternoon_snack:{label:"Lanche tarde",icon:"🫐"},
  dinner:{label:"Jantar",icon:"🌙"},
  supper:{label:"Ceia",icon:"🌿"},
};
function MealSection({ mealKey, items, onAdd, onRemove, onSave }) {
  const meta = MEAL_META[mealKey];
  const total = items.reduce((a,f) => ({ cal:a.cal+f.calories, prot:a.prot+f.protein }), {cal:0,prot:0});
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ background:T.w, borderRadius:18, padding:14, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <button type="button" onClick={() => setExpanded(!expanded)} style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:0 }}>
          <span style={{ fontSize:18 }}>{meta.icon}</span>
          <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{meta.label}</span>
          {items.length > 0 && <span style={{ fontSize:11, color:T.m, background:T.mP, borderRadius:8, padding:"2px 8px", fontWeight:700 }}>{Math.round(total.cal)} kcal</span>}
          <span style={{ fontSize:11, color:T.inkM }}>{expanded?"▲":"▼"}</span>
        </button>
        <div style={{ display:"flex", gap:6 }}>
          {items.length > 0 && <Btn small variant="ghost" onClick={onSave}>💾</Btn>}
          <Btn small variant="secondary" onClick={onAdd}>+ Add</Btn>
        </div>
      </div>
      {expanded && items.length > 0 && (
        <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
          {items.map(food => (
            <div key={food.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.sL, borderRadius:10, padding:"8px 12px" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{food.name}</div>
                <div style={{ fontSize:11, color:T.inkM }}>{food.amount}{food.unit} · P:{food.protein}g C:{food.carbs}g G:{food.fat}g</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:8 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.m, flexShrink:0 }}>{Math.round(food.calories)}</div>
                <button type="button" onClick={() => onRemove(food.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.inkM, fontSize:16, padding:"0 2px" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FASTING SCREEN ───────────────────────────────────────────────────────────
const PROTOCOLS = [
  {id:"12:12",label:"12:12",fastHours:12,eatHours:12,desc:"Iniciante · Janela de 12h"},
  {id:"14:10",label:"14:10",fastHours:14,eatHours:10,desc:"Fácil · Janela de 10h"},
  {id:"16:8",label:"16:8",fastHours:16,eatHours:8,desc:"Popular · Janela de 8h"},
  {id:"18:6",label:"18:6",fastHours:18,eatHours:6,desc:"Avançado · Janela de 6h"},
  {id:"20:4",label:"20:4",fastHours:20,eatHours:4,desc:"Warrior · Janela de 4h"},
  {id:"OMAD",label:"OMAD",fastHours:23,eatHours:1,desc:"Uma refeição por dia"},
];

function FastingScreen() {
  const { activeFast, fastingLog, startFast, endFast, deleteFastEntry, profile } = useApp();
  const [showProto, setShowProto] = useState(false);
  const [selProto, setSelProto] = useState(PROTOCOLS[2]);
  const [customHours, setCustomHours] = useState("16");
  const [isCustom, setIsCustom] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState("timer");

  useEffect(() => {
    if (!activeFast) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeFast]);

  const elapsed = activeFast ? (now - new Date(activeFast.startTime)) / 3600000 : 0;
  const target = activeFast?.targetHours || selProto.fastHours;
  const pct = Math.min(100, (elapsed / target) * 100);
  const remaining = Math.max(0, target - elapsed);

  const fmtTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  // Streak
  const streak = (() => {
    if (!fastingLog.length) return 0;
    const days = [...new Set(fastingLog.filter(f => f.success).map(f => f.startTime ? localDateKey(f.startTime) : null))].sort().reverse();
    let count = 0;
    let check = new Date(); check.setHours(0,0,0,0);
    for (const day of days) {
      const d = new Date(day + "T12:00:00"); d.setHours(0,0,0,0);
      const diff = Math.round((check - d) / 86400000);
      if (diff <= 1) { count++; check = d; } else break;
    }
    return count;
  })();

  const successRate = fastingLog.length ? Math.round((fastingLog.filter(f=>f.success).length / fastingLog.length) * 100) : 0;

  const motivationMsgs = [
    "Você já completou " + Math.round(pct) + "% do seu jejum de hoje.",
    "Consistência cria resultados. Continue! 💪",
    "Mais um passo na sua jornada.",
    "Pequenas ações diárias constroem grandes transformações.",
    "You Are a Star ✦ Você consegue!",
  ];
  const motivMsg = activeFast ? motivationMsgs[Math.floor(pct / 20) % motivationMsgs.length] : "";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:T.sL, borderRadius:12, padding:3 }}>
        {[["timer","⏳ Timer"],["history","📋 Histórico"],["stats","📊 Stats"]].map(([id,label]) => (
          <button type="button" key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:tab===id?T.w:"transparent", color:tab===id?T.m:T.inkM, fontWeight:700, fontSize:11, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {tab === "timer" && <>
        {/* Protocol selector */}
        {!activeFast && (
          <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>Protocolo de jejum</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
              {PROTOCOLS.map(p => (
                <button type="button" key={p.id} onClick={() => { setSelProto(p); setIsCustom(false); }}
                  style={{ background:selProto.id===p.id && !isCustom?T.m:T.sL, color:selProto.id===p.id && !isCustom?T.w:T.ink, border:"none", borderRadius:12, padding:"10px 6px", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{p.label}</div>
                  <div style={{ fontSize:9, color:selProto.id===p.id && !isCustom?"rgba(255,255,255,0.8)":T.inkM, marginTop:2, lineHeight:1.3 }}>{p.desc.split("·")[0]}</div>
                </button>
              ))}
              <button type="button" onClick={() => setIsCustom(true)}
                style={{ background:isCustom?T.m:T.sL, color:isCustom?T.w:T.ink, border:"none", borderRadius:12, padding:"10px 6px", cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:14, fontWeight:700 }}>Custom</div>
                <div style={{ fontSize:9, color:isCustom?"rgba(255,255,255,0.8)":T.inkM, marginTop:2 }}>Personalizado</div>
              </button>
            </div>
            {isCustom && (
              <Field label="Horas de jejum" type="number" value={customHours} onChange={setCustomHours} unit="h" placeholder="16" min="1" max="23" />
            )}
            <div style={{ background:T.sL, borderRadius:12, padding:10, marginTop:8, fontSize:12, color:T.inkM }}>
              {isCustom
                ? `Jejum de ${customHours}h · Janela de alimentação: ${Math.max(1,24-(+customHours||16))}h`
                : selProto.desc
              }
            </div>
          </div>
        )}

        {/* Timer circle */}
        <div style={{ background: activeFast ? `linear-gradient(135deg, ${T.mP}, ${T.sL})` : T.w, borderRadius:22, padding:24, textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ position:"relative", width:180, height:180, margin:"0 auto" }}>
            <svg width={180} height={180} style={{ transform:"rotate(-90deg)" }}>
              <circle cx={90} cy={90} r={80} fill="none" stroke={T.s} strokeWidth={12} />
              <circle cx={90} cy={90} r={80} fill="none" stroke={T.m} strokeWidth={12}
                strokeDasharray={`${(pct/100)*2*Math.PI*80} ${2*Math.PI*80}`}
                strokeLinecap="round" style={{ transition:"stroke-dasharray 1s ease" }} />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              {activeFast ? <>
                <div style={{ fontSize:11, color:T.inkM, textTransform:"uppercase", letterSpacing:"0.06em" }}>Em jejum</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:T.ink, lineHeight:1.1 }}>{fmtTime(elapsed)}</div>
                <div style={{ fontSize:11, color:T.m, fontWeight:600, marginTop:2 }}>{Math.round(pct)}%</div>
              </> : <>
                <div style={{ fontSize:30 }}>⏳</div>
                <div style={{ fontSize:13, color:T.inkM, marginTop:4 }}>Pronto?</div>
              </>}
            </div>
          </div>

          {activeFast && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:12, color:T.inkM }}>
                Protocolo: <strong>{activeFast.protocol.label}</strong> · Meta: {fmtTime(target)}
              </div>
              <div style={{ fontSize:12, color:T.m, fontWeight:600, marginTop:4 }}>
                {remaining > 0 ? `Faltam ${fmtTime(remaining)}` : "Meta atingida! 🎉"}
              </div>
              <div style={{ background:T.w, borderRadius:12, padding:"8px 14px", marginTop:10, fontSize:12, color:T.inkS, fontStyle:"italic" }}>
                {motivMsg}
              </div>
            </div>
          )}

          {streak > 0 && !activeFast && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginTop:10 }}>
              <span style={{ fontSize:20 }}>🔥</span>
              <span style={{ fontSize:14, fontWeight:700, color:T.mD }}>{streak} dias consecutivos</span>
            </div>
          )}

          <div style={{ marginTop:16 }}>
            {activeFast ? (
              <div style={{ display:"flex", gap:8 }}>
                <Btn fullWidth variant="danger" onClick={endFast}>✓ Encerrar jejum</Btn>
                <Btn variant="ghost" onClick={endFast} style={{ padding:"12px 16px" }}>⏭</Btn>
              </div>
            ) : (
              <Btn fullWidth variant="dark" onClick={() => {
                const proto = isCustom
                  ? { id:"custom", label:`${customHours}:${24-(+customHours||16)}`, fastHours: +customHours||16, eatHours: 24-(+customHours||16) }
                  : selProto;
                startFast(proto);
              }}>▶ Iniciar jejum {isCustom ? customHours+"h" : selProto.label}</Btn>
            )}
          </div>
        </div>
      </>}

      {tab === "history" && <div>
        {fastingLog.length === 0
          ? <Empty icon="⏳" title="Nenhum jejum registrado" sub="Inicie seu primeiro jejum e acompanhe seu histórico aqui." />
          : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...fastingLog].reverse().slice(0, 30).map((entry, i) => (
              <div key={i} style={{ background:T.w, borderRadius:14, padding:14, boxShadow:"0 1px 6px rgba(0,0,0,0.04)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{entry.protocol?.label || "Jejum"}</span>
                    <span style={{ fontSize:10, background:entry.success?T.mP:T.warnBg, color:entry.success?T.mD:T.warn, borderRadius:6, padding:"2px 8px", fontWeight:700 }}>{entry.success?"✓ Concluído":"Interrompido"}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.inkM }}>
                    {entry.startTime ? new Date(entry.startTime).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"}) : "—"}
                    {" · "}{entry.durationHours?.toFixed(1)}h realizado
                  </div>
                </div>
                <button type="button" onClick={() => deleteFastEntry(entry.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.inkM, fontSize:16, padding:4 }}>✕</button>
              </div>
            ))}
          </div>
        }
      </div>}

      {tab === "stats" && <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            {icon:"🔥",l:"Streak atual",v:streak,u:"dias"},
            {icon:"📊",l:"Total de jejuns",v:fastingLog.length,u:"sessões"},
            {icon:"✅",l:"Taxa de sucesso",v:successRate,u:"%"},
            {icon:"⏱️",l:"Maior jejum",v:fastingLog.length?Math.max(...fastingLog.map(f=>f.durationHours||0)).toFixed(1):0,u:"horas"},
          ].map((s,i) => (
            <div key={i} style={{ background:T.w, borderRadius:16, padding:16, textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:T.ink }}>{s.v}</div>
              <div style={{ fontSize:9, color:T.inkM }}>{s.u}</div>
              <div style={{ fontSize:11, color:T.inkS, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {fastingLog.length > 0 && (
          <div style={{ background:T.w, borderRadius:18, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:12 }}>Últimos 7 jejuns</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:70 }}>
              {[...fastingLog].slice(-7).map((entry, i) => {
                const maxH = 24;
                const h = 10 + ((entry.durationHours||0) / maxH) * 55;
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ fontSize:8, color:T.inkM }}>{(entry.durationHours||0).toFixed(0)}h</div>
                    <div style={{ width:"100%", height:h, borderRadius:"3px 3px 2px 2px", background:entry.success?T.m:T.sD }} />
                    <div style={{ fontSize:8, color:T.inkM }}>{entry.startTime ? new Date(entry.startTime).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}) : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {fastingLog.length === 0 && <Empty icon="📊" title="Sem dados ainda" sub="Complete seu primeiro jejum para ver estatísticas." />}
      </div>}
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name:"Franciane", age:"26", sex:"feminino", height:"174",
    currentWeight:"116.15", goalWeight:"92", goalDays:"180",
    waist:"99", belly:"120", hip:"136", bust:"114", armR:"40", armL:"40", thighR:"72", thighL:"73",
    waterGoal:"2500", stepsGoal:"8000",
    calorieGoal:"1700", proteinGoal:"120", carbGoal:"150", fatGoal:"55",
  });
  const s = k => v => setForm(p => ({...p, [k]:v}));
  const recommendation = calculateFitnessTargets(form);
  const useRecommendation = () => setForm(p => ({ ...p, calorieGoal:String(recommendation.calorieGoal), proteinGoal:String(recommendation.proteinGoal), carbGoal:String(recommendation.carbGoal), fatGoal:String(recommendation.fatGoal) }));

  const steps = [
    {
      title:"Olá! 🌿", sub:"Vamos começar sua jornada", icon:"🌱",
      valid: () => true,
      content: (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Field label="Seu nome *" value={form.name} onChange={s("name")} placeholder="Como posso te chamar?" autoFocus />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Idade *" type="number" value={form.age} onChange={s("age")} unit="anos" placeholder="25" />
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:T.inkM, display:"block", marginBottom:4 }}>Sexo *</label>
              <div style={{ display:"flex", gap:6 }}>
                {[["feminino","♀"],["masculino","♂"]].map(([v,icon]) => (
                  <button type="button" key={v} onClick={() => s("sex")(v)} style={{ flex:1, padding:"10px 0", borderRadius:12, border:"none", background:form.sex===v?T.m:T.sL, color:form.sex===v?T.w:T.ink, fontWeight:700, fontSize:14, cursor:"pointer" }}>{icon}</button>
                ))}
              </div>
            </div>
          </div>
          <Field label="Altura *" type="number" value={form.height} onChange={s("height")} unit="cm" placeholder="174" />
        </div>
      ),
    },
    {
      title:"Dados físicos", sub:"Seu ponto de partida 💪", icon:"⚖️",
      valid: () => true,
      content: (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ background:T.mP, borderRadius:14, padding:12, fontSize:13, color:T.mD }}>Você atualizará esses dados semanalmente!</div>
          <Field label="Peso atual *" type="number" value={form.currentWeight} onChange={s("currentWeight")} unit="kg" placeholder="Ex: 116.15" step="0.05" autoFocus />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[["waist","Cintura"],["belly","Barriga"],["hip","Quadril"],["bust","Busto"],["armR","Braço Dir."],["armL","Braço Esq."],["thighR","Coxa Dir."],["thighL","Coxa Esq."]].map(([k,l]) => (
              <Field key={k} label={l} type="number" value={form[k]} onChange={s(k)} unit="cm" placeholder="—" />
            ))}
          </div>
        </div>
      ),
    },
    {
      title:"Seu objetivo", sub:"Onde você quer chegar? 🏁", icon:"🎯",
      valid: () => true,
      content: (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <Field label="Peso meta *" type="number" value={form.goalWeight} onChange={s("goalWeight")} unit="kg" placeholder="Ex: 92" step="0.5" autoFocus />
          <Field label="Prazo" type="number" value={form.goalDays} onChange={s("goalDays")} unit="dias" placeholder="180" />
          <Field label="Meta de água diária" type="number" value={form.waterGoal} onChange={s("waterGoal")} unit="ml" placeholder="2500" />
          <Field label="Meta de passos diária" type="number" value={form.stepsGoal} onChange={s("stepsGoal")} unit="passos" placeholder="8000" />
          {form.currentWeight && form.goalWeight && (
            <div style={{ background:T.sL, borderRadius:14, padding:12, textAlign:"center" }}>
              <span style={{ fontSize:13, color:T.ink }}>Déficit estimado: </span>
              <span style={{ fontSize:14, fontWeight:700, color:T.m }}>~{Math.round((+form.currentWeight - +form.goalWeight)*7700/(+form.goalDays||180))} kcal/dia</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title:"Metas nutricionais", sub:"Sua estratégia alimentar 🥗", icon:"🥗",
      valid: () => true,
      content: (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ background:T.mP, borderRadius:14, padding:12, fontSize:12, color:T.mD, lineHeight:1.55 }}>
            <strong>Indicação automática para sua meta:</strong><br />
            Gasto estimado: {recommendation.tdee} kcal/dia · déficit seguro: {recommendation.safeDeficit} kcal/dia<br />
            Meta considerada: <strong>{recommendation.calorieGoal} kcal</strong> · perda estimada: {recommendation.predictedLossPerWeek}kg/semana<br />
            Ritmo da meta: <strong>{recommendation.feasibility}</strong>
            <div style={{ marginTop:10 }}><Btn small variant="secondary" onClick={useRecommendation}>Usar recomendação</Btn></div>
          </div>
          <Field label="Calorias diárias *" type="number" value={form.calorieGoal} onChange={s("calorieGoal")} unit="kcal" autoFocus />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            <Field label="Proteína" type="number" value={form.proteinGoal} onChange={s("proteinGoal")} unit="g" />
            <Field label="Carbs" type="number" value={form.carbGoal} onChange={s("carbGoal")} unit="g" />
            <Field label="Gordura" type="number" value={form.fatGoal} onChange={s("fatGoal")} unit="g" />
          </div>
          <div style={{ background:T.sL, borderRadius:14, padding:14 }}>
            {[["🔥","Calorias",form.calorieGoal,"kcal"],["💪","Proteína",form.proteinGoal,"g"],["🌾","Carbs",form.carbGoal,"g"],["🫒","Gordura",form.fatGoal,"g"]].map(([icon,name,v,u]) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                <span style={{ color:T.inkS }}>{icon} {name}</span>
                <span style={{ fontWeight:700, color:T.m }}>{v} {u}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const cur = steps[step];

  const handleComplete = () => {
    try {
      onComplete(
        {
          name:(form.name || "Franciane").trim(), age:+form.age || 26, sex:form.sex || "feminino", height:+form.height || 174,
          currentWeight:+form.currentWeight || 116.15, startWeight:+form.currentWeight || 116.15,
          goalWeight:+form.goalWeight || 92, goalDays:+form.goalDays||180,
          startDate:todayKey(),
          waterGoal:+form.waterGoal||2500, stepsGoal:+form.stepsGoal||8000,
          calorieGoal:+form.calorieGoal||1700, proteinGoal:+form.proteinGoal||120,
          carbGoal:+form.carbGoal||150, fatGoal:+form.fatGoal||55,
          nutritionPlan: calculateFitnessTargets(form),
        },
        { waist:+form.waist||null, belly:+form.belly||null, hip:+form.hip||null, bust:+form.bust||null, armR:+form.armR||null, armL:+form.armL||null, thighR:+form.thighR||null, thighL:+form.thighL||null },
        +form.currentWeight
      );
    } catch(e) { console.error("Onboarding complete error:", e); }
  };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg, ${T.sL} 0%, ${T.mP} 100%)`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.m }}>You Are a Star ✦</div>
          <div style={{ fontSize:12, color:T.inkM, marginTop:2 }}>Cada pequena ação conta</div>
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:18 }}>
          {steps.map((_,i) => <div key={i} style={{ width:i===step?22:7, height:7, borderRadius:4, background:i===step?T.m:i<step?T.mL:T.s, transition:"all 0.3s" }} />)}
        </div>
        <div style={{ background:T.w, borderRadius:28, padding:"24px 22px", boxShadow:"0 8px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>{cur.icon}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.ink, marginBottom:4 }}>{cur.title}</div>
            <div style={{ fontSize:13, color:T.inkM }}>{cur.sub}</div>
          </div>
          {cur.content}
          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            {step > 0 && <Btn variant="ghost" onClick={() => setStep(s => s-1)} style={{ flex:1 }}>← Voltar</Btn>}
            {step < steps.length-1
              ? <Btn onClick={() => setStep(s => Math.min(s+1, steps.length-1))} style={{ flex:1 }}>Próximo →</Btn>
              : <Btn onClick={handleComplete} style={{ flex:1 }}>🌿 Começar!</Btn>
            }
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:14, fontSize:11, color:T.inkM }}>Dados salvos localmente · Instale como PWA no iPhone</div>
      </div>
    </div>
  );
}


// ─── ANALYTICS HELPERS ───────────────────────────────────────────────────────
function dateKeysBack(days = 7) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return localDateKey(d);
  });
}

function getMealEntries(log) {
  return Object.values(log?.meals || {}).flat().filter(Boolean);
}

function calcLogTotals(log) {
  const foods = getMealEntries(log);
  const exercises = Array.isArray(log?.exercises) ? log.exercises : [];
  return {
    calories: foods.reduce((a, f) => a + (Number(f.calories) || 0), 0),
    protein: foods.reduce((a, f) => a + (Number(f.protein) || 0), 0),
    carbs: foods.reduce((a, f) => a + (Number(f.carbs) || 0), 0),
    fat: foods.reduce((a, f) => a + (Number(f.fat) || 0), 0),
    exerciseCalories: exercises.reduce((a, e) => a + (Number(e.calories) || 0), 0),
    steps: Number(log?.steps) || 0,
    water: Number(log?.water) || 0,
  };
}

function MiniBarChart({ data, valueKey, labelKey="label", max, suffix="", height=86 }) {
  const vals = data.map(d => Number(d[valueKey]) || 0);
  const top = max || Math.max(1, ...vals);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:5, height, paddingTop:8 }}>
      {data.map((d,i) => {
        const v = Number(d[valueKey]) || 0;
        const h = Math.max(4, Math.round((v / top) * (height - 26)));
        return <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div title={`${v}${suffix}`} style={{ width:"100%", height:h, borderRadius:"6px 6px 3px 3px", background:i===data.length-1?T.m:T.s }} />
          <div style={{ fontSize:8, color:T.inkM, whiteSpace:"nowrap" }}>{d[labelKey]}</div>
        </div>;
      })}
    </div>
  );
}

function Sparkline({ data, valueKey, suffix="", height=82 }) {
  const vals = data.map(d => Number(d[valueKey])).filter(v => !isNaN(v));
  if (vals.length < 2) return <Empty icon="📈" title="Dados insuficientes" sub="Registre pelo menos 2 dias para ver o gráfico." />;
  const min = Math.min(...vals), max = Math.max(...vals);
  const w = 340, h = height, pad = 12;
  const points = data.map((d, i) => {
    const v = Number(d[valueKey]);
    const x = pad + (i * (w - pad*2)) / Math.max(1, data.length - 1);
    const y = max === min ? h/2 : pad + ((max - v) * (h - pad*2)) / (max - min);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} style={{ display:"block" }}>
        <polyline points={points} fill="none" stroke={T.m} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d,i) => {
          const [x,y] = points.split(" ")[i].split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r={4} fill={i===data.length-1?T.mD:T.sD}><title>{Number(d[valueKey])}{suffix}</title></circle>;
        })}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:T.inkM }}>
        <span>{data[0]?.label || data[0]?.date?.slice(5)}</span><span>{data[data.length-1]?.label || data[data.length-1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

function DailyHistoryCard({ dateKey, log }) {
  const totals = calcLogTotals(log);
  const meals = Object.entries(MEAL_META).map(([k,m]) => ({ key:k, ...m, items: log?.meals?.[k] || [] })).filter(m => m.items.length);
  return (
    <div style={{ background:T.w, borderRadius:16, padding:14, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{formatDateBR(dateKey,{weekday:"long",day:"2-digit",month:"2-digit"})}</div>
        <div style={{ fontSize:12, fontWeight:800, color:T.mD }}>{Math.round(totals.calories)} kcal</div>
      </div>
      {meals.length ? meals.map(meal => (
        <div key={meal.key} style={{ marginTop:8, borderTop:`1px solid ${T.sL}`, paddingTop:8 }}>
          <div style={{ fontSize:11, fontWeight:800, color:T.inkS, marginBottom:4 }}>{meal.icon} {meal.label}</div>
          {meal.items.map(item => <div key={item.id || item.name} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.inkM, marginTop:2 }}>
            <span>{item.name} · {item.amount}{item.unit || "g"}</span><span>{item.calories} kcal</span>
          </div>)}
        </div>
      )) : <div style={{ fontSize:12, color:T.inkM }}>Sem alimentos registrados nesse dia.</div>}
    </div>
  );
}


function getDateRange(days) {
  const arr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(localDateKey(d));
  }
  return arr;
}

function getDailyMetrics(dailyLogs, profile, days = 7) {
  const keys = getDateRange(days);
  return keys.map(k => {
    const log = dailyLogs?.[k] || {};
    const totals = calcLogTotals(log);
    const exerciseCalories = (log.exercises || []).reduce((a, e) => a + (Number(e.calories) || 0), 0);
    const exerciseMinutes = (log.exercises || []).reduce((a, e) => a + (Number(e.duration) || 0), 0);
    return {
      date: k,
      label: formatDateBR(k, { day:"2-digit", month:"2-digit" }),
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      water: Number(log.water) || 0,
      waterL: Math.round(((Number(log.water) || 0) / 1000) * 10) / 10,
      steps: Number(log.steps) || 0,
      exerciseCalories,
      exerciseMinutes,
      score: Math.round(
        Math.min(25, ((totals.calories || 0) / (profile?.calorieGoal || 1700)) * 25) +
        Math.min(25, ((totals.protein || 0) / (profile?.proteinGoal || 120)) * 25) +
        Math.min(25, ((Number(log.water) || 0) / (profile?.waterGoal || 2500)) * 25) +
        Math.min(25, ((Number(log.steps) || 0) / (profile?.stepsGoal || 8000)) * 25)
      )
    };
  });
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, x) => a + (Number(x[key]) || 0), 0) / arr.length);
}

function getSugarStats(sugarLog, startDate) {
  const entries = Object.values(sugarLog || {}).filter(Boolean).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const total = entries.filter(e => e.sugarFree).length;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = localDateKey(d);
    if (sugarLog?.[k]?.sugarFree) streak += 1;
    else break;
  }
  let best = 0, run = 0;
  const first = startDate || entries[0]?.date || todayKey();
  const days = Math.max(1, daysSinceLocal(first) + 1);
  getDateRange(Math.min(days, 365)).forEach(k => {
    if (sugarLog?.[k]?.sugarFree) { run += 1; best = Math.max(best, run); }
    else run = 0;
  });
  const todayDone = !!sugarLog?.[todayKey()]?.sugarFree;
  const nextMilestone = [15,30,60,90,180].find(m => streak < m) || 180;
  return { total, streak, best, todayDone, nextMilestone, remainingToMilestone: Math.max(0, nextMilestone - streak) };
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen() {
  const { profile, todayData, totals, updateWater, activeFast, sugarLog, toggleSugarFreeToday, measurements } = useApp();
  const [showWater, setShowWater] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showEx, setShowEx] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [fastNow, setFastNow] = useState(Date.now());

  useEffect(() => {
    if (!activeFast) return;
    const t = setInterval(() => setFastNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeFast]);

  const g = profile;
  const waterL = (todayData.water || 0) / 1000;
  const waterGoalL = (g.waterGoal || 2500) / 1000;
  const steps = todayData.steps || 0;
  const stepsGoal = g.stepsGoal || 8000;

  const score = Math.round(
    Math.min(25, (totals.calories / g.calorieGoal) * 25) +
    Math.min(25, (totals.protein / g.proteinGoal) * 25) +
    Math.min(25, (waterL / waterGoalL) * 25) +
    Math.min(25, (steps / stepsGoal) * 25)
  );

  const daysPassed = daysSinceLocal(g.startDate);
  const daysLeft = Math.max(0, g.goalDays - daysPassed);
  const weightLost = g.startWeight - g.currentWeight;
  const totalLoss = g.startWeight - g.goalWeight;
  const pct = totalLoss > 0 ? Math.round((weightLost / totalLoss) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const currentDateLabel = formatDateBR(todayKey(), { weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" });
  const sugarStats = getSugarStats(sugarLog, g.startDate);
  const measurementList = Array.isArray(measurements) ? measurements : [];

  const fastElapsed = activeFast ? (fastNow - new Date(activeFast.startTime)) / 3600000 : 0;
  const fastPct = activeFast ? Math.min(100, (fastElapsed / activeFast.targetHours) * 100) : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, ${T.s} 0%, ${T.sD} 100%)`, borderRadius:22, padding:"20px 20px 16px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-25, right:-15, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.15)" }} />
        <div style={{ fontSize:11, color:T.mD, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>Dia {daysPassed} · {daysLeft} restantes ✦</div>
        <div style={{ fontSize:12, color:T.inkS, fontWeight:600, marginBottom:6 }}>Hoje: {currentDateLabel}</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.ink, marginBottom:6 }}>{greeting}, {g.name} 🌿</div>
        {weightLost > 0
          ? <div style={{ fontSize:13, color:T.inkS }}>Você já perdeu <strong style={{ color:T.mD }}>{weightLost.toFixed(1)}kg</strong> — {pct}% da meta!</div>
          : <div style={{ fontSize:13, color:T.inkS }}>You Are a Star ✦ Cada pequena ação conta!</div>
        }
        <div style={{ marginTop:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.inkS, marginBottom:4 }}>
            <span>{g.startWeight}kg</span><span>{g.goalWeight}kg meta</span>
          </div>
          <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,0.4)", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:4, background:T.m, width:`${Math.min(100,Math.max(0,pct))}%`, transition:"width 1s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.inkS, marginTop:4 }}>
            <span style={{ fontWeight:700, color:T.mD }}>{g.currentWeight}kg atual</span>
            <span>{pct}% concluído</span>
          </div>
        </div>
      </div>


      {/* Sugar-free challenge */}
      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 10px rgba(131,143,88,0.08)", border:`1px solid ${sugarStats.todayDone ? T.mP : T.sL}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <div>
            <div style={{ fontSize:11, color:T.inkM, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.06em" }}>Desafio sem açúcar</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:T.ink, marginTop:2 }}>{sugarStats.streak} dias seguidos</div>
            <div style={{ fontSize:12, color:T.inkS, marginTop:2 }}>
              Próximo marco: {sugarStats.nextMilestone} dias · faltam {sugarStats.remainingToMilestone}
            </div>
          </div>
          <button type="button" onClick={toggleSugarFreeToday} style={{ border:"none", borderRadius:16, padding:"10px 12px", cursor:"pointer", background:sugarStats.todayDone?T.m:T.sL, color:sugarStats.todayDone?T.w:T.ink, fontWeight:800, fontSize:12, minWidth:96 }}>
            {sugarStats.todayDone ? "✓ Hoje ok" : "Marcar hoje"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:12 }}>
          {[["Total", sugarStats.total, "dias"],["Melhor", sugarStats.best, "dias"],["Hoje", sugarStats.todayDone?"Sim":"Pendente", ""]].map((x,i) => (
            <div key={i} style={{ background:i===2 && sugarStats.todayDone?T.mP:T.sL, borderRadius:12, padding:10, textAlign:"center" }}>
              <div style={{ fontSize:10, color:T.inkM, fontWeight:700 }}>{x[0]}</div>
              <div style={{ fontSize:18, fontWeight:900, color:i===2 && sugarStats.todayDone?T.mD:T.ink }}>{x[1]}</div>
              {x[2] && <div style={{ fontSize:9, color:T.inkM }}>{x[2]}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Score + macros */}
      <div style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:10 }}>
        <div style={{ background:T.w, borderRadius:18, padding:14, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 10px rgba(131,143,88,0.09)" }}>
          <div style={{ position:"relative", width:80, height:80 }}>
            <svg width={80} height={80} style={{ transform:"rotate(-90deg)" }}>
              <circle cx={40} cy={40} r={32} fill="none" stroke={T.s} strokeWidth={7} />
              <circle cx={40} cy={40} r={32} fill="none" stroke={T.m} strokeWidth={7}
                strokeDasharray={`${(score/100)*2*Math.PI*32} ${2*Math.PI*32}`}
                strokeLinecap="round" style={{ transition:"stroke-dasharray 1s" }} />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.ink, lineHeight:1 }}>{score}</div>
              <div style={{ fontSize:8, color:T.inkM, textTransform:"uppercase", letterSpacing:"0.06em" }}>score</div>
            </div>
          </div>
          <div style={{ fontSize:10, color:T.inkM, marginTop:6, textAlign:"center" }}>Score do dia</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {[
            {l:"Calorias",v:totals.calories,g:g.calorieGoal,u:"kcal",c:T.sD},
            {l:"Proteína",v:totals.protein,g:g.proteinGoal,u:"g",c:T.m},
            {l:"Carbs",v:totals.carbs,g:g.carbGoal,u:"g",c:T.mL},
            {l:"Gordura",v:totals.fat,g:g.fatGoal,u:"g",c:"#E8A87C"},
          ].map(m => (
            <div key={m.l} style={{ background:T.w, borderRadius:10, padding:"7px 12px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:T.inkM, fontWeight:500 }}>{m.l}</span>
                <span style={{ fontSize:11, fontWeight:700, color:m.c }}>{Math.round(m.v)}<span style={{ color:T.inkM, fontWeight:400 }}>/{m.g}{m.u}</span></span>
              </div>
              <Bar pct={(m.v/m.g)*100} color={m.c} h={5} />
            </div>
          ))}
        </div>
      </div>

      {/* Water + Steps */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <button type="button" onClick={() => setShowWater(true)} style={{ background:T.w, borderRadius:18, padding:14, border:"none", cursor:"pointer", textAlign:"left", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>💧 Água</span>
            <span style={{ fontSize:11, color:T.m, fontWeight:700 }}>{waterL.toFixed(2).replace(".",",")}L</span>
          </div>
          <Bar pct={(waterL/waterGoalL)*100} color={T.m} h={7} />
          <div style={{ fontSize:10, color:T.inkM, marginTop:5 }}>Meta: {waterGoalL.toFixed(1)}L</div>
          <div style={{ display:"flex", gap:4, marginTop:8 }}>
            {[250, 500].map(waterAmount => (
              <button type="button" key={waterAmount} onClick={e => { e.stopPropagation(); updateWater(waterAmount); }}
                style={{ flex:1, background:T.mP, border:"none", borderRadius:8, fontSize:10, color:T.mD, fontWeight:700, padding:"5px 0", cursor:"pointer" }}>+{waterAmount}ml</button>
            ))}
          </div>
        </button>
        <button type="button" onClick={() => setShowSteps(true)} style={{ background:T.w, borderRadius:18, padding:14, border:"none", cursor:"pointer", textAlign:"left", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>👟 Passos</span>
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:T.ink, marginBottom:4 }}>{steps.toLocaleString("pt-BR")}</div>
          <Bar pct={(steps/stepsGoal)*100} color={T.m} h={7} />
          <div style={{ fontSize:10, color:T.inkM, marginTop:5 }}>Meta: {stepsGoal.toLocaleString("pt-BR")}</div>
        </button>
      </div>

      {/* Active fast card */}
      {activeFast && (
        <div style={{ background:`linear-gradient(135deg, ${T.mP}, ${T.sL})`, borderRadius:18, padding:14, border:`1.5px solid ${T.m}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.mD }}>⏳ Jejum ativo · {activeFast.protocol.label}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.ink, marginTop:2 }}>
                {String(Math.floor(fastElapsed)).padStart(2,"0")}:{String(Math.floor((fastElapsed%1)*60)).padStart(2,"0")}h
              </div>
              <div style={{ fontSize:11, color:T.inkM, marginTop:2 }}>{Math.round(fastPct)}% da meta</div>
            </div>
            <Ring pct={fastPct} color={T.m} size={60} />
          </div>
          <Bar pct={fastPct} color={T.m} h={6} />
        </div>
      )}

      {/* Exercises */}
      <div style={{ background:T.w, borderRadius:18, padding:14, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:todayData.exercises?.length?10:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>🏋️ Exercícios</span>
          <Btn small variant="secondary" onClick={() => setShowEx(true)}>+ Registrar</Btn>
        </div>
        {todayData.exercises?.length > 0
          ? todayData.exercises.map(ex => (
            <div key={ex.id} style={{ background:T.mP, borderRadius:10, padding:"8px 12px", marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:600, color:T.mD }}>{ex.name}</span>
              <span style={{ fontSize:11, color:T.inkM }}> · {ex.duration}min · ~{ex.calories}kcal</span>
            </div>
          ))
          : <div style={{ fontSize:12, color:T.inkM, paddingTop:6 }}>Nenhum exercício hoje</div>
        }
      </div>

      <button type="button" onClick={() => setShowWeight(true)} style={{ background:`linear-gradient(135deg, ${T.mP}, ${T.sL})`, border:`1.5px solid ${T.s}`, borderRadius:16, padding:14, cursor:"pointer", textAlign:"left", width:"100%" }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>⚖️ Registrar peso de hoje</div>
        <div style={{ fontSize:11, color:T.inkM, marginTop:2 }}>Atual: {g.currentWeight}kg · toque para atualizar</div>
      </button>

      <WaterSheet open={showWater} onClose={() => setShowWater(false)} />
      <StepsSheet open={showSteps} onClose={() => setShowSteps(false)} />
      <ExerciseSheet open={showEx} onClose={() => setShowEx(false)} />

      {measurementList.length >= 2 && (
        <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>Gráficos por medida</div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {MFIELDS.map(f => {
              const series = measurementList.filter(m => m[f.k]).map(m => ({ date:m.date, label:m.date.slice(5), value:m[f.k] }));
              if (series.length < 2) return null;
              const firstV = series[0].value;
              const lastV = series[series.length - 1].value;
              const diff = Math.round((lastV - firstV) * 10) / 10;
              return <div key={f.k} style={{ background:T.sL, borderRadius:14, padding:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:900, color:T.ink }}>{f.l}</div>
                  <div style={{ fontSize:11, fontWeight:900, color:diff <= 0 ? T.mD : T.warn }}>{diff > 0 ? "+" : ""}{diff}cm</div>
                </div>
                <Sparkline data={series} valueKey="value" suffix="cm" height={60} />
              </div>;
            }).filter(Boolean)}
          </div>
        </div>
      )}

      <WeightSheet open={showWeight} onClose={() => setShowWeight(false)} />
    </div>
  );
}

// ─── DIARY SCREEN ─────────────────────────────────────────────────────────────
function DiaryScreen() {
  const { todayData, totals, profile, removeFoodFromMeal, recentWeights, dailyLogs } = useApp();
  const [addMeal, setAddMeal] = useState(null);
  const [saveMeal, setSaveMeal] = useState(null);
  const [tab, setTab] = useState("hoje");
  const g = profile;
  const last7Keys = dateKeysBack(7);
  const last7 = last7Keys.map(k => ({ date:k, label:formatDateBR(k,{weekday:"short"}).replace(".",""), ...calcLogTotals(dailyLogs[k]) }));
  const calAvg = Math.round(last7.reduce((a,d)=>a+d.calories,0)/7);
  const stepAvg = Math.round(last7.reduce((a,d)=>a+d.steps,0)/7);
  const exAvg = Math.round(last7.reduce((a,d)=>a+d.exerciseCalories,0)/7);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:4, background:T.sL, borderRadius:12, padding:3 }}>
        {[["hoje","Hoje"],["semana","7 dias"],["historico","Histórico"]].map(([id,label]) => (
          <button type="button" key={id} onClick={() => setTab(id)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:tab===id?T.w:"transparent", color:tab===id?T.m:T.inkM, fontWeight:700, fontSize:13, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {tab === "hoje" ? <>
        <div style={{ background:`linear-gradient(135deg, ${T.mP}, ${T.sL})`, borderRadius:20, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:700, color:T.ink }}>{Math.round(totals.calories)}<span style={{ fontSize:14, color:T.inkM, fontWeight:400 }}> kcal</span></div>
              <div style={{ fontSize:12, color:T.inkS, marginTop:2 }}>
                {g.calorieGoal - totals.calories > 0
                  ? `${Math.round(g.calorieGoal - totals.calories)} kcal restantes`
                  : `${Math.round(totals.calories - g.calorieGoal)} kcal acima da meta`}
              </div>
            </div>
            <Ring pct={(totals.calories/g.calorieGoal)*100} color={T.m} size={68} />
          </div>
          <div style={{ display:"flex", gap:6, marginTop:12 }}>
            {[["Proteína",totals.protein,g.proteinGoal,"g",T.m],["Carbs",totals.carbs,g.carbGoal,"g","#E8A87C"],["Gordura",totals.fat,g.fatGoal,"g",T.sD]].map(([l,v,gv,u,c]) => (
              <div key={l} style={{ flex:1, background:T.w, borderRadius:10, padding:"8px 4px", textAlign:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize:10, color:T.inkM }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:700, color:c }}>{Math.round(v*10)/10}g</div>
                <div style={{ fontSize:9, color:T.inkM }}>/{gv}g</div>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(MEAL_META).map(key => (
          <MealSection key={key} mealKey={key}
            items={todayData.meals[key] || []}
            onAdd={() => setAddMeal(key)}
            onRemove={(id) => removeFoodFromMeal(key, id)}
            onSave={() => setSaveMeal({ key, items: todayData.meals[key] || [] })}
          />
        ))}
      </> : tab === "semana" ? (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[{l:"Média kcal",v:calAvg},{l:"Média passos",v:stepAvg},{l:"Média exercício",v:exAvg+" kcal"}].map((x,i)=>(
              <div key={i} style={{ background:T.w, borderRadius:14, padding:12, textAlign:"center", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize:10, color:T.inkM }}>{x.l}</div><div style={{ fontSize:17, fontWeight:800, color:T.ink, marginTop:3 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:8 }}>Calorias consumidas · últimos 7 dias</div>
            <MiniBarChart data={last7} valueKey="calories" max={Math.max(g.calorieGoal, ...last7.map(d=>d.calories))} suffix=" kcal" />
          </div>
          <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:8 }}>Passos · últimos 7 dias</div>
            <MiniBarChart data={last7} valueKey="steps" max={Math.max(8000, ...last7.map(d=>d.steps))} suffix=" passos" />
          </div>
          <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:8 }}>Calorias gastas com exercício · últimos 7 dias</div>
            <MiniBarChart data={last7} valueKey="exerciseCalories" suffix=" kcal" />
          </div>
          {recentWeights.length >= 2 && <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:8 }}>Evolução de peso</div>
            <Sparkline data={recentWeights.map(w=>({...w,label:w.date.slice(5)}))} valueKey="kg" suffix="kg" />
          </div>}
        </>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[...Object.keys(dailyLogs || {})].sort().reverse().slice(0,30).map(k => <DailyHistoryCard key={k} dateKey={k} log={dailyLogs[k]} />)}
          {Object.keys(dailyLogs || {}).length === 0 && <Empty icon="📘" title="Sem histórico" sub="Seus registros por refeição aparecerão aqui, organizados por data." />}
        </div>
      )}
      <AddFoodSheet open={!!addMeal} onClose={() => setAddMeal(null)} mealKey={addMeal} mealLabel={addMeal ? MEAL_META[addMeal]?.label : ""} />
      <SaveMealSheet open={!!saveMeal} onClose={() => setSaveMeal(null)} items={saveMeal?.items || []} />
    </div>
  );
}

// ─── JOURNEY SCREEN ───────────────────────────────────────────────────────────
function JourneyScreen() {
  const { profile, weightLog } = useApp();
  const g = profile;
  const daysPassed = daysSinceLocal(g.startDate);
  const daysLeft = Math.max(0, g.goalDays - daysPassed);
  const weightLost = g.startWeight - g.currentWeight;
  const totalLoss = g.startWeight - g.goalWeight;
  const pct = totalLoss > 0 ? Math.round((weightLost / totalLoss) * 100) : 0;
  const wl = Array.isArray(weightLog) ? weightLog : [];
  const pace = wl.length >= 2 ? Math.abs(wl[wl.length-2].kg - wl[wl.length-1].kg) : 0.45;

  const milestones = [
    {l:"Início",kg:g.startWeight,reached:true,icon:"🌱"},
    ...[5,10,15,20,25,30].map((n,i) => {
      const tgt = g.startWeight - n; if (tgt < g.goalWeight - 1) return null;
      return {l:`−${n}kg`,kg:tgt,reached:weightLost>=n,icon:["🥉","🥈","🥇","🏆","⭐","🌟"][i]};
    }).filter(Boolean),
    {l:"Meta final!",kg:g.goalWeight,reached:g.currentWeight<=g.goalWeight,icon:"🏁"},
  ];

  const projs = [30,60,90,180].map(d => ({
    d, w: Math.max(g.goalWeight, g.currentWeight - pace*(d/7)).toFixed(1),
    date: formatDateBR(localDateKey(new Date(parseLocalDate(todayKey()).getTime()+d*86400000)),{day:"2-digit",month:"short"}),
  }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:`linear-gradient(135deg, ${T.s}, ${T.sD})`, borderRadius:22, padding:22, textAlign:"center" }}>
        <div style={{ fontSize:11, color:T.mD, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>You Are a Star ✦ Minha Transformação</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:46, fontWeight:700, color:T.ink, lineHeight:1 }}>
          {weightLost>0?weightLost.toFixed(1):"0"}<span style={{ fontSize:20 }}>kg</span>
        </div>
        <div style={{ fontSize:13, color:T.inkS, marginTop:4 }}>perdidos de {totalLoss.toFixed(1)}kg · dia {daysPassed}</div>
        <div style={{ marginTop:14 }}>
          <div style={{ height:10, borderRadius:5, background:"rgba(255,255,255,0.4)", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:5, background:`linear-gradient(90deg, ${T.mD}, ${T.m})`, width:`${Math.min(100,pct)}%`, transition:"width 1s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:T.inkS }}>
            <span>{g.startWeight}kg</span>
            <span style={{ fontWeight:700, color:T.mD }}>{pct}% · {daysLeft} dias restantes</span>
            <span>{g.goalWeight}kg</span>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[{icon:"📅",l:"Na jornada",v:daysPassed,u:"dias"},{icon:"⏳",l:"Restantes",v:daysLeft,u:"dias"},{icon:"🎯",l:"Meta",v:g.goalWeight,u:"kg"}].map((s,i) => (
          <div key={i} style={{ background:T.w, borderRadius:14, padding:12, textAlign:"center", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:T.ink }}>{s.v}</div>
            <div style={{ fontSize:9, color:T.inkM }}>{s.u}</div>
            <div style={{ fontSize:10, color:T.inkS, marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ background:T.w, borderRadius:20, padding:18, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:14 }}>Marcos da jornada</div>
        <div style={{ position:"relative" }}>
          <div style={{ position:"absolute", left:21, top:22, bottom:22, width:2, background:`linear-gradient(${T.m}, ${T.s})` }} />
          {milestones.map((m,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:i<milestones.length-1?16:0 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", flexShrink:0, background:m.reached?T.m:T.sL, border:`3px solid ${m.reached?T.m:T.s}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, zIndex:1 }}>{m.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:m.reached?T.ink:T.inkM }}>{m.l}</div>
                <div style={{ fontSize:11, color:T.inkM }}>{m.kg}kg</div>
              </div>
              {m.reached && <div style={{ background:T.mP, borderRadius:8, padding:"3px 10px", fontSize:10, color:T.mD, fontWeight:700 }}>✓</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:T.w, borderRadius:20, padding:18, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>🔮 Projeções</div>
        <div style={{ fontSize:11, color:T.inkM, marginBottom:12 }}>{wl.length>=2?"Baseado no seu ritmo atual":"Estimativa padrão"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {projs.map((p,i) => (
            <div key={i} style={{ background:i===3?`linear-gradient(135deg, ${T.mP}, ${T.sL})`:T.sL, borderRadius:14, padding:14, border:i===3?`2px solid ${T.m}`:"none" }}>
              <div style={{ fontSize:10, color:T.inkM, marginBottom:3 }}>+{p.d} dias ({p.date})</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:i===3?T.mD:T.ink }}>{p.w}kg</div>
              {i===3 && <div style={{ fontSize:10, color:T.m, fontWeight:700, marginTop:4 }}>🏆 Projeção final</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COACH SCREEN ─────────────────────────────────────────────────────────────
function CoachScreen() {
  const { profile, totals, todayData } = useApp();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const g = profile;

  useEffect(() => {
    const day = Math.max(1, daysSinceLocal(g.startDate));
    const lost = (g.startWeight - g.currentWeight).toFixed(1);
    setMsgs([{ role:"coach", text:`Oi, ${g.name}! ✨ Você está no dia ${day} da sua jornada${+lost>0?` e já perdeu ${lost}kg`:""}. Como posso te ajudar?` }]);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setMsgs(p => [...p, { role:"user", text:txt }]);
    setInput("");
    setLoading(true);
    const day = Math.max(1, daysSinceLocal(g.startDate));
    const ctx = `Você é o Coach IA do app "You Are a Star" — app premium de emagrecimento e bem-estar.
Usuária: ${g.name}, ${g.age} anos, ${g.height}cm, sexo ${g.sex}.
Peso: inicial ${g.startWeight}kg → atual ${g.currentWeight}kg → meta ${g.goalWeight}kg. Dia ${day}.
Hoje: ${Math.round(totals.calories)}kcal (meta ${g.calorieGoal}) · proteína ${Math.round(totals.protein)}g (meta ${g.proteinGoal}g) · água ${((todayData.water||0)/1000).toFixed(1)}L · passos ${todayData.steps||0}.
Responda em português, tom amigável e motivador. Máximo 3 frases.
Se a usuária descrever o que comeu: forneça estimativa no formato: 🍽️ Nome: ~X kcal | Xg prot | Xg carbs | Xg gord`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:ctx, messages:[{role:"user",content:txt}] })
      });
      const d = await r.json();
      setMsgs(p => [...p, { role:"coach", text:d.content?.[0]?.text || "Não consegui conectar agora 🌿" }]);
    } catch {
      setMsgs(p => [...p, { role:"coach", text:"Sem conexão no momento. Mas estou aqui quando voltar! 🌿" }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 160px)" }}>
      <div style={{ background:`linear-gradient(135deg, ${T.m}, ${T.mD})`, borderRadius:18, padding:16, marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>✨</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:T.w }}>Coach IA · You Are a Star</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>Nutrição · Registro por texto · Motivação</div>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, paddingBottom:4 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ background:m.role==="user"?T.m:T.w, borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"11px 15px", maxWidth:"86%", boxShadow:m.role==="coach"?"0 2px 8px rgba(0,0,0,0.06)":"none", fontSize:13, color:m.role==="user"?T.w:T.ink, lineHeight:1.55, whiteSpace:"pre-wrap" }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ background:T.w, borderRadius:"18px 18px 18px 4px", padding:"12px 16px", width:56, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", gap:4 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.m, animation:`bounce 1.2s infinite ${i*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display:"flex", gap:8, marginTop:10, paddingTop:10, borderTop:`1px solid ${T.sL}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
          inputMode="text" enterKeyHint="send" autoComplete="off"
          placeholder="Descreva o que comeu ou pergunte algo..."
          style={{ WebkitAppearance:"none", appearance:"none", WebkitUserSelect:"text", userSelect:"text", touchAction:"auto", pointerEvents:"auto", flex:1, background:T.w, border:`1.5px solid ${T.s}`, borderRadius:14, padding:"11px 14px", fontSize:16, color:T.ink, outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
        <button type="button" onClick={send} style={{ background:T.m, border:"none", borderRadius:14, width:44, height:44, color:T.w, fontSize:18, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>→</button>
      </div>
    </div>
  );
}


// ─── ANALYSIS SCREEN ─────────────────────────────────────────────────────────
function AnalysisScreen() {
  const { profile, dailyLogs, weightLog, measurements, sugarLog } = useApp();
  const [range, setRange] = useState("7");
  const days = range === "30" ? 30 : range === "90" ? 90 : 7;
  const data = getDailyMetrics(dailyLogs, profile, days);
  const today = data[data.length - 1] || {};
  const weekAvgCalories = avg(data, "calories");
  const weekAvgSteps = avg(data, "steps");
  const weekAvgWater = avg(data, "water");
  const weekExercise = data.reduce((a,d) => a + (d.exerciseCalories || 0), 0);
  const sugarStats = getSugarStats(sugarLog, profile?.startDate);
  const wl = Array.isArray(weightLog) ? weightLog : [];
  const measurementList = Array.isArray(measurements) ? measurements : [];
  const latestM = measurementList[measurementList.length - 1];
  const firstM = measurementList[0];

  const Insight = ({ children }) => <div style={{ background:T.mP, color:T.mD, borderRadius:14, padding:12, fontSize:12, lineHeight:1.55, fontWeight:600 }}>{children}</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:`linear-gradient(135deg, ${T.m}, ${T.mD})`, borderRadius:22, padding:18, color:T.w }}>
        <div style={{ fontSize:11, opacity:0.8, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:800 }}>Central de análise</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, marginTop:4 }}>Seu painel gerencial</div>
        <div style={{ fontSize:12, opacity:0.82, marginTop:4 }}>Calorias, água, passos, exercício, corpo e desafio sem açúcar em uma visão só.</div>
      </div>

      <div style={{ display:"flex", gap:6, background:T.sL, borderRadius:14, padding:4 }}>
        {[["7","7 dias"],["30","Mês"],["90","90 dias"]].map(([id,label]) => <button type="button" key={id} onClick={()=>setRange(id)} style={{ flex:1, border:"none", borderRadius:11, padding:"9px 0", background:range===id?T.w:"transparent", color:range===id?T.mD:T.inkM, fontWeight:800, fontSize:12 }}>{label}</button>)}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          ["🔥", "Kcal média", weekAvgCalories, `meta ${profile?.calorieGoal || 1700}`],
          ["💧", "Água média", Math.round(weekAvgWater/100)/10 + "L", `meta ${((profile?.waterGoal||2500)/1000).toFixed(1)}L`],
          ["👟", "Passos médios", weekAvgSteps, `meta ${profile?.stepsGoal || 8000}`],
          ["⚡", "Kcal gastas", weekExercise, `em ${days} dias`],
        ].map((c,i) => <div key={i} style={{ background:T.w, borderRadius:16, padding:14, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:22 }}>{c[0]}</div>
          <div style={{ fontSize:10, color:T.inkM, fontWeight:800, marginTop:4 }}>{c[1]}</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, fontWeight:700, color:T.ink }}>{c[2]}</div>
          <div style={{ fontSize:10, color:T.inkM }}>{c[3]}</div>
        </div>)}
      </div>

      <Insight>
        Hoje: {today.calories || 0} kcal consumidas, {today.exerciseCalories || 0} kcal gastas em exercício, {(today.water || 0)}ml de água e {today.steps || 0} passos. O placar não briga com você, ele só acende o mapa.
      </Insight>

      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Calorias consumidas por dia</div>
        <MiniBarChart data={data} valueKey="calories" suffix=" kcal" />
      </div>
      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Calorias gastas com exercício</div>
        <MiniBarChart data={data} valueKey="exerciseCalories" suffix=" kcal" />
      </div>
      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Passos</div>
        <MiniBarChart data={data} valueKey="steps" suffix=" passos" />
      </div>
      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Água</div>
        <MiniBarChart data={data} valueKey="waterL" suffix="L" />
      </div>

      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>Desafio sem açúcar</div>
          <div style={{ fontSize:12, fontWeight:900, color:T.mD }}>{sugarStats.streak} dias</div>
        </div>
        <Bar pct={(sugarStats.streak / sugarStats.nextMilestone) * 100} color={T.m} h={9} />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:T.inkM }}>
          <span>Total: {sugarStats.total} dias</span><span>Melhor sequência: {sugarStats.best}</span><span>Marco: {sugarStats.nextMilestone}</span>
        </div>
      </div>

      {wl.length >= 2 && <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Evolução do peso</div>
        <Sparkline data={wl.map(w => ({...w, label:w.date.slice(5)}))} valueKey="kg" suffix="kg" />
      </div>}

      {latestM && firstM && <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Resumo de medidas</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {MFIELDS.map(f => {
            const a = firstM?.[f.k]; const b = latestM?.[f.k];
            if (!a || !b) return null;
            const diff = Math.round((b - a) * 10) / 10;
            return <div key={f.k} style={{ background:T.sL, borderRadius:12, padding:10 }}>
              <div style={{ fontSize:10, color:T.inkM, fontWeight:800 }}>{f.l}</div>
              <div style={{ fontSize:13, color:T.ink, fontWeight:900 }}>{a} → {b}cm</div>
              <div style={{ fontSize:11, color:diff <= 0 ? T.mD : T.warn, fontWeight:900 }}>{diff > 0 ? "+" : ""}{diff}cm</div>
            </div>;
          }).filter(Boolean)}
        </div>
      </div>}
    </div>
  );
}

// ─── BODY SCREEN ──────────────────────────────────────────────────────────────
function BodyScreen() {
  const { profile, weightLog, measurements } = useApp();
  const [showWeight, setShowWeight] = useState(false);
  const [showMeas, setShowMeas] = useState(false);
  const g = profile;
  const wl = Array.isArray(weightLog) ? weightLog : [];
  const measurementList = Array.isArray(measurements) ? measurements : [];
  const latest = measurementList[measurementList.length-1];
  const first = measurementList[0];
  const imc = g.currentWeight / ((g.height/100)**2);
  const imcLabel = imc<18.5?"Abaixo do peso":imc<25?"Peso normal":imc<30?"Sobrepeso":imc<35?"Obesidade I":"Obesidade II";
  const imcColor = imc<25?T.m:imc<30?T.gold:T.warn;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:`linear-gradient(135deg, ${T.s}, ${T.sD})`, borderRadius:22, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, color:T.inkM, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>Peso atual</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:40, fontWeight:700, color:T.ink, lineHeight:1 }}>{g.currentWeight}<span style={{ fontSize:16 }}> kg</span></div>
            {g.startWeight > g.currentWeight && (
              <div style={{ fontSize:12, color:T.inkS, marginTop:5 }}><span style={{ color:T.mD, fontWeight:700 }}>−{(g.startWeight-g.currentWeight).toFixed(1)}kg </span>desde o início</div>
            )}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:T.inkM, marginBottom:2 }}>IMC</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:T.ink }}>{imc.toFixed(1)}</div>
            <div style={{ fontSize:10, color:imcColor, fontWeight:600 }}>{imcLabel}</div>
          </div>
        </div>
        <Btn fullWidth variant="pink" onClick={() => setShowWeight(true)}>+ Registrar peso de hoje</Btn>
      </div>

      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:10 }}>Histórico de peso</div>
        {wl.length > 0
          ? <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
            {[...wl].reverse().map((w,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.sL, borderRadius:10, padding:"8px 12px" }}>
                <span style={{ fontSize:13, color:T.inkS }}>{new Date(w.date+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"})}</span>
                <span style={{ fontSize:14, fontWeight:700, color:i===0?T.m:T.ink }}>{w.kg}kg</span>
              </div>
            ))}
          </div>
          : <Empty icon="⚖️" title="Nenhuma pesagem" sub="Registre seu peso diariamente para acompanhar a evolução." />
        }
      </div>

      <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>Medidas Corporais</div>
          <Btn small variant="secondary" onClick={() => setShowMeas(true)}>Atualizar</Btn>
        </div>
        {latest
          ? <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {MFIELDS.map(f => {
              const curr = latest[f.k]; if (!curr) return null;
              const ini = first?.[f.k];
              const diff = ini && ini > curr ? (ini-curr).toFixed(1) : null;
              return (
                <div key={f.k} style={{ background:T.sL, borderRadius:12, padding:12 }}>
                  <div style={{ fontSize:10, color:T.inkM, fontWeight:600, marginBottom:2 }}>{f.l}</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, color:T.ink }}>{curr}<span style={{ fontSize:10, color:T.inkM }}>cm</span></div>
                  {diff && <div style={{ fontSize:10, color:T.m, fontWeight:700, marginTop:2 }}>−{diff}cm ↓</div>}
                </div>
              );
            }).filter(Boolean)}
          </div>
          : <Empty icon="📏" title="Sem medidas" sub="Registre suas medidas para acompanhar a transformação além do peso." />
        }
      </div>


      {wl.length >= 2 && (
        <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:10 }}>Gráfico do peso</div>
          <Sparkline data={wl.map(w => ({...w, label:w.date.slice(5)}))} valueKey="kg" suffix="kg" />
        </div>
      )}

      {measurementList.length >= 2 && latest && (
        <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:10 }}>Comparação de medidas</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {MFIELDS.map(f => {
              const ini = first?.[f.k]; const curr = latest?.[f.k];
              if (!ini || !curr) return null;
              const diff = (curr - ini).toFixed(1);
              return <div key={f.k} style={{ background:T.sL, borderRadius:12, padding:10 }}>
                <div style={{ fontSize:10, color:T.inkM, fontWeight:700 }}>{f.l}</div>
                <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{ini} → {curr}cm</div>
                <div style={{ fontSize:10, color:Number(diff)<=0?T.m:T.warn, fontWeight:800 }}>{Number(diff)<=0?"":"+"}{diff}cm</div>
              </div>;
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {measurementList.length >= 2 && (
        <div style={{ background:T.w, borderRadius:20, padding:16, boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>Gráficos por medida</div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {MFIELDS.map(f => {
              const series = measurementList.filter(m => m[f.k]).map(m => ({ date:m.date, label:m.date.slice(5), value:m[f.k] }));
              if (series.length < 2) return null;
              const firstV = series[0].value;
              const lastV = series[series.length - 1].value;
              const diff = Math.round((lastV - firstV) * 10) / 10;
              return <div key={f.k} style={{ background:T.sL, borderRadius:14, padding:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:900, color:T.ink }}>{f.l}</div>
                  <div style={{ fontSize:11, fontWeight:900, color:diff <= 0 ? T.mD : T.warn }}>{diff > 0 ? "+" : ""}{diff}cm</div>
                </div>
                <Sparkline data={series} valueKey="value" suffix="cm" height={60} />
              </div>;
            }).filter(Boolean)}
          </div>
        </div>
      )}

      <WeightSheet open={showWeight} onClose={() => setShowWeight(false)} />
      <MeasSheet open={showMeas} onClose={() => setShowMeas(false)} initial={latest} />
    </div>
  );
}

// ─── SETTINGS SHEET ───────────────────────────────────────────────────────────
function SettingsSheet({ open, onClose }) {
  const { profile, saveProfile, resetAll, showToast } = useApp();
  const [draft, setDraft] = useState(() => ({
    calorieGoal: profile?.calorieGoal || 1700,
    proteinGoal: profile?.proteinGoal || 130,
    carbGoal: profile?.carbGoal || 150,
    fatGoal: profile?.fatGoal || 55,
    waterGoal: profile?.waterGoal || 2500,
    stepGoal: profile?.stepGoal || 8000,
    waterReminder: profile?.waterReminder || false,
    waterReminderMinutes: profile?.waterReminderMinutes || 90,
  }));

  useEffect(() => {
    if (!open) return;
    setDraft({
      calorieGoal: profile?.calorieGoal || 1700,
      proteinGoal: profile?.proteinGoal || 130,
      carbGoal: profile?.carbGoal || 150,
      fatGoal: profile?.fatGoal || 55,
      waterGoal: profile?.waterGoal || 2500,
      stepGoal: profile?.stepGoal || 8000,
      waterReminder: profile?.waterReminder || false,
      waterReminderMinutes: profile?.waterReminderMinutes || 90,
    });
  }, [open, profile]);

  const saveGoals = async () => {
    const clean = { ...profile };
    ["calorieGoal","proteinGoal","carbGoal","fatGoal","waterGoal","stepGoal","waterReminderMinutes"].forEach(k => clean[k] = Number(draft[k]) || clean[k]);
    clean.waterReminder = !!draft.waterReminder;
    saveProfile(clean);
    if (clean.waterReminder && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    showToast?.("Metas atualizadas ✓");
  };

  const exportData = () => {
    const data = {};
    Object.keys(localStorage).filter(k=>k.startsWith("yas_")).forEach(k => data[k] = localStorage.getItem(k));
    const blob = new Blob([JSON.stringify({ exportedAt:new Date().toISOString(), data }, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `you-are-a-star-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const data = payload.data || payload;
        Object.entries(data).forEach(([k,v]) => { if (k.startsWith("yas_")) localStorage.setItem(k, v); });
        window.location.reload();
      } catch { alert("Arquivo de backup inválido."); }
    };
    reader.readAsText(file);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Configurações">
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:T.sL, borderRadius:14, padding:14 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{profile?.name} ✦</div>
          <div style={{ fontSize:12, color:T.inkM, marginTop:2 }}>Início: {profile?.startDate ? formatDateBR(profile.startDate) : "—"}</div>
          <div style={{ fontSize:12, color:T.inkM }}>Meta: {profile?.goalWeight}kg em {profile?.goalDays} dias</div>
        </div>

        <div style={{ background:T.w, borderRadius:16, padding:14, boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>Metas manuais</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <Field label="Kcal" type="number" value={draft.calorieGoal} onChange={v=>setDraft({...draft,calorieGoal:v})} />
            <Field label="Proteína (g)" type="number" value={draft.proteinGoal} onChange={v=>setDraft({...draft,proteinGoal:v})} />
            <Field label="Carbs (g)" type="number" value={draft.carbGoal} onChange={v=>setDraft({...draft,carbGoal:v})} />
            <Field label="Gordura (g)" type="number" value={draft.fatGoal} onChange={v=>setDraft({...draft,fatGoal:v})} />
            <Field label="Água (ml)" type="number" value={draft.waterGoal} onChange={v=>setDraft({...draft,waterGoal:v})} />
            <Field label="Passos" type="number" value={draft.stepGoal} onChange={v=>setDraft({...draft,stepGoal:v})} />
          </div>
          <div style={{ marginTop:10, background:T.mP, borderRadius:12, padding:10 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:T.mD, fontWeight:700 }}>
              <input type="checkbox" checked={!!draft.waterReminder} onChange={e=>setDraft({...draft,waterReminder:e.target.checked})} /> Lembrete de água enquanto o app estiver aberto
            </label>
            <div style={{ marginTop:8 }}><Field label="Intervalo do lembrete (min)" type="number" value={draft.waterReminderMinutes} onChange={v=>setDraft({...draft,waterReminderMinutes:v})} /></div>
            <div style={{ fontSize:10, color:T.inkM, lineHeight:1.5 }}>Notificação em segundo plano real precisa de service worker/push. Este arquivo já deixa o lembrete local pronto para uso no PWA aberto.</div>
          </div>
          <div style={{ marginTop:10 }}><Btn fullWidth onClick={saveGoals}>Salvar metas</Btn></div>
        </div>

        <div style={{ background:T.w, borderRadius:16, padding:14, boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:8 }}>Backup dos dados</div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn small variant="secondary" onClick={exportData}>Exportar</Btn>
            <label style={{ flex:1, textAlign:"center", background:T.sL, color:T.mD, borderRadius:12, padding:"9px 10px", fontSize:12, fontWeight:800, cursor:"pointer" }}>
              Importar<input type="file" accept="application/json" onChange={importData} style={{ display:"none" }} />
            </label>
          </div>
        </div>

        <div style={{ background:T.mP, borderRadius:14, padding:14, fontSize:12, color:T.mD, lineHeight:1.7 }}>
          <strong>📱 Instalar como app (PWA):</strong><br />
          <strong>iPhone:</strong> Safari → compartilhar → Adicionar à Tela de Início<br />
          <strong>Android:</strong> Chrome → menu ⋮ → Adicionar à tela inicial
        </div>
        <div style={{ background:T.sL, borderRadius:14, padding:12, fontSize:12, color:T.inkM, lineHeight:1.6 }}>
          📦 Dados salvos no localStorage do dispositivo<br />
          🔄 Use exportar/importar como cópia de segurança<br />
          ☁️ Sync na nuvem: próxima fase com Supabase
        </div>
        <div style={{ borderTop:`1px solid ${T.sL}`, paddingTop:10 }}>
          <Btn variant="danger" fullWidth onClick={() => { if (window.confirm("⚠️ Apagar TODOS os dados? Esta ação não pode ser desfeita.")) { resetAll(); } }}>
            🗑️ Resetar todos os dados
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const NAV = [
  {id:"home",icon:"◎",label:"Início"},
  {id:"diary",icon:"🍽️",label:"Diário"},
  {id:"journey",icon:"🏁",label:"Jornada"},
  {id:"fasting",icon:"⏳",label:"Jejum"},
  {id:"analysis",icon:"📈",label:"Análise"},
  {id:"coach",icon:"✨",label:"Coach"},
  {id:"body",icon:"📊",label:"Corpo"},
];

function MainApp() {
  const { toast, profile, todayData, showToast } = useApp();
  const [screen, setScreen] = useState("home");
  const [showSettings, setShowSettings] = useState(false);
  const SCREENS = { home:HomeScreen, diary:DiaryScreen, journey:JourneyScreen, fasting:FastingScreen, analysis:AnalysisScreen, coach:CoachScreen, body:BodyScreen };
  const Screen = SCREENS[screen] || HomeScreen;
  const titles = { home:"You Are a Star ✦", diary:"Diário Alimentar", journey:"Minha Jornada", fasting:"Jejum Intermitente", analysis:"Análise Gerencial", coach:"Coach IA ✨", body:"Meu Corpo" };

  useEffect(() => {
    if (!profile?.waterReminder) return;
    const minutes = Math.max(15, Number(profile.waterReminderMinutes) || 90);
    const tick = () => {
      const water = Number(todayData?.water) || 0;
      const goal = Number(profile.waterGoal) || 2500;
      if (water >= goal) return;
      const msg = `Hora da água: faltam ${Math.max(0, goal - water)}ml para a meta de hoje.`;
      try {
        if ("Notification" in window && Notification.permission === "granted") new Notification("You Are a Star 💧", { body: msg });
        else showToast?.(msg, "info");
      } catch { showToast?.(msg, "info"); }
    };
    const id = setInterval(tick, minutes * 60000);
    return () => clearInterval(id);
  }, [profile?.waterReminder, profile?.waterReminderMinutes, profile?.waterGoal, todayData?.water, showToast]);

  return (
    <div style={{ minHeight:"100vh", background:"#F5EEF0" }}>
      <div style={{ maxWidth:430, margin:"0 auto", position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 18px 0" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:T.m }}>{titles[screen]}</div>
            <div style={{ fontSize:11, color:T.inkM, marginTop:2 }}>Hoje: {formatDateBR(todayKey())}</div>
          </div>
          <button type="button" onClick={() => setShowSettings(true)} style={{ width:34, height:34, borderRadius:"50%", background:T.s, border:"none", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
        </div>
        <div style={{ padding:"14px 16px 96px" }}>
          <Screen />
        </div>
        <div style={{ position:"fixed", bottom:14, left:"50%", transform:"translateX(-50%)", width:"calc(100% - 24px)", maxWidth:406, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(20px)", borderRadius:22, padding:"7px 2px", border:"1px solid rgba(255,255,255,0.6)", boxShadow:"0 8px 28px rgba(0,0,0,0.09)", display:"flex", justifyContent:"space-around", zIndex:100 }}>
          {NAV.map(item => (
            <button type="button" key={item.id} onClick={() => setScreen(item.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:screen===item.id?T.mP:"transparent", border:"none", cursor:"pointer", padding:"6px 8px", borderRadius:14, transition:"background 0.2s", minWidth:38 }}>
              <div style={{ fontSize:screen===item.id?17:15 }}>{item.icon}</div>
              <div style={{ fontSize:8, fontWeight:700, color:screen===item.id?T.mD:T.inkM, textTransform:"uppercase", letterSpacing:"0.04em" }}>{item.label}</div>
            </button>
          ))}
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
        <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function Root() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { profile, saveProfile, logWeight, saveMeasurement } = useApp();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const handleOnboard = (prof, meas, weight) => {
    try {
      saveProfile(prof);
      logWeight(weight, prof.startDate);
      if (meas && Object.values(meas).some(v => v)) saveMeasurement(meas);
    } catch(e) { console.error("Onboarding save error:", e); }
  };

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#F5EEF0}
    input::placeholder{color:#B8B8BE}
    ::-webkit-scrollbar{width:0}
    @keyframes slideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
    @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  `;

  if (!profile) return <><style>{CSS}</style><Onboarding onComplete={handleOnboard} /></>;
  return <><style>{CSS}</style><MainApp /></>;
}
