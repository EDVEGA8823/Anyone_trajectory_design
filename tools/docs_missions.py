# -*- coding: utf-8 -*-
"""資料「スイングバイの極意 その2」に載せる軌道を、保存ファイルの形で固めたもの。

自動調整は打ち切り時間で結果が変わりうるので、いちど詰めた設計を JSON として
ここに置き、本文の数字も図もここから起こす。こうしておけば、図を撮り直しても
本文と食い違わない。作り方 (手順) は資料の本文に書いてある。

  直行        地球 → 木星 (スイングバイなし)。比べるための下敷き
  ΔVEGA長     2年より長い同期軌道 (781日) を使う ΔVEGA
  ΔVEGA短     2年より短い同期軌道 (678日) を使う ΔVEGA
  VEGA        地球 → 金星 → 地球 → 木星
  VEEGA       地球 → 金星 → 地球 → 地球 → 木星
  EVE1回      地球 → 金星 → 地球 のあと、地球スイングバイ1回で終わり (最終軌道)
  EVE2回      そこに2年同期を挟んで、地球スイングバイ2回で終わり (最終軌道)
"""
import json

MISSIONS = json.loads(r"""
{
 "直行": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "木星へ直行",
  "launcher": "h3_24",
  "launch": {
   "vinf": 3,
   "alpha": 0,
   "delta": 0
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2463322.5,
    "planet": 2
   },
   {
    "type": "Orbit",
    "date": 2464042.5,
    "planet": 4
   }
  ]
 },
 "ΔVEGA長": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "ΔVEGA (長い2年同期)",
  "launcher": "h3_24",
  "launch": {
   "vinf": 5.216757748575221,
   "alpha": 0.002666163964138182,
   "delta": 0.0009245810142022304
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2462551.6471712072,
    "planet": 2,
    "manual": true
   },
   {
    "type": "Maneuver",
    "date": 2462963.156146387
   },
   {
    "type": "Swingby",
    "date": 2463332.774172932,
    "planet": 2,
    "rp": 6678.137192685312,
    "beta": -1.965409527268199
   },
   {
    "type": "Orbit",
    "date": 2464164.9783308245,
    "planet": 4
   }
  ]
 },
 "ΔVEGA短": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "ΔVEGA (短い2年同期)",
  "launcher": "h3_24",
  "launch": {
   "vinf": 5.165061556164644,
   "alpha": 0.003661558716321748,
   "delta": -0.0010579997202757596
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2462638.6452862,
    "planet": 2,
    "manual": true
   },
   {
    "type": "Maneuver",
    "date": 2463023.707662842
   },
   {
    "type": "Swingby",
    "date": 2463317.390922829,
    "planet": 2,
    "rp": 6678.1385048692755,
    "beta": -1.9949087963273464
   },
   {
    "type": "Orbit",
    "date": 2464393.435651529,
    "planet": 4
   }
  ]
 },
 "VEGA": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "VEGA",
  "launcher": "h3_24",
  "launch": {
   "vinf": 5.165061556164644,
   "alpha": 0.003661558716321748,
   "delta": -0.0010579997202757596
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2463079.813772975,
    "planet": 2
   },
   {
    "type": "Swingby",
    "date": 2463246.9090707866,
    "planet": 1,
    "rp": 8544.331133373827,
    "beta": -1.690100092514791,
    "rev": 1
   },
   {
    "type": "Swingby",
    "date": 2463770.6006946205,
    "planet": 2,
    "rp": 6678.137,
    "beta": -1.5169021184281313
   },
   {
    "type": "Orbit",
    "date": 2464616.379189568,
    "planet": 4
   }
  ]
 },
 "VEEGA": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "VEEGA",
  "launcher": "h3_24",
  "launch": {
   "vinf": 5.165061556164644,
   "alpha": 0.003661558716321748,
   "delta": -0.0010579997202757596
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2462413.1880819085,
    "planet": 2
   },
   {
    "type": "Swingby",
    "date": 2462600.09514607,
    "planet": 1,
    "rp": 15132.025318805794,
    "beta": -1.1482276549631325
   },
   {
    "type": "Swingby",
    "date": 2462916.242908715,
    "planet": 2,
    "rp": 11843.115829300252,
    "beta": -1.5582240719510472,
    "rev": 1
   },
   {
    "type": "Swingby",
    "date": 2463744.357481368,
    "planet": 2,
    "rp": 7467.517737734774,
    "beta": -1.986560435059641
   },
   {
    "type": "Orbit",
    "date": 2464707.1074003913,
    "planet": 4
   }
  ]
 },
 "EVE1回": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "地球→金星→地球 + 1回",
  "launcher": "h3_24",
  "launch": {
   "vinf": 3,
   "alpha": 0,
   "delta": 0
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2462412.5,
    "planet": 2
   },
   {
    "type": "Swingby",
    "date": 2462599.5,
    "planet": 1,
    "rp": 15216.421742635303,
    "beta": -1.148743749131587
   },
   {
    "type": "Swingby",
    "date": 2462915.5,
    "planet": 2,
    "manual": true,
    "rp": 6678.137,
    "beta": 4.71238898038469
   },
   {
    "type": "End",
    "date": 2463476.5
   }
  ]
 },
 "EVE2回": {
  "format": "anyone-trajectory-design",
  "version": 1,
  "name": "地球→金星→地球 + 2回",
  "launcher": "h3_24",
  "launch": {
   "vinf": 3,
   "alpha": 0,
   "delta": 0
  },
  "nodes": [
   {
    "type": "Launch",
    "date": 2462412.5,
    "planet": 2
   },
   {
    "type": "Swingby",
    "date": 2462599.5,
    "planet": 1,
    "rp": 15216.421742635303,
    "beta": -1.148743749131587
   },
   {
    "type": "Swingby",
    "date": 2462915.5,
    "planet": 2,
    "rp": 11838.985414334926,
    "beta": -1.552812704896748,
    "rev": 1
   },
   {
    "type": "Swingby",
    "date": 2463743.5,
    "planet": 2,
    "manual": true,
    "rp": 6678.137,
    "beta": 4.71238898038469
   },
   {
    "type": "End",
    "date": 2464937.5
   }
  ]
 }
}
""")


def js(name):
    """シナリオの手順に埋め込む JS の式 (__D.load(...))"""
    return "__D.load(%s)" % json.dumps(MISSIONS[name], ensure_ascii=False)
