# Westminster Map data

TrafficLab uses a local vector extract of OpenStreetMap through OpenFreeMap and the OpenMapTiles schema. The pinned snapshot is `20261101_080013_pt`, 1 November 2026. The source tile template is `https://tiles.openfreemap.org/planet/20261101_080013_pt/14/{x}/{y}.pbf`. Nine tiles cover the crop from 51.488° to 51.514° N and −0.146° to −0.107° E.

© OpenStreetMap contributors. OpenFreeMap · © OpenMapTiles. The derivative map database in [westminster.js](westminster.js) is distributed under the Open Data Commons Open Database License 1.0. The module contains the same data the offline app renders. See the [OpenStreetMap copyright notice](https://www.openstreetmap.org/copyright), [ODbL text](https://opendatacommons.org/licenses/odbl/1-0/) and [OpenFreeMap](https://openfreemap.org/).

The extract includes building rings and courtyards, source render heights, visible transportation centerlines, greenspace and water. Buildings use upstream render heights, which can be estimates. A local classroom patch replaces the road geometry where the teaching model meets Parliament Square. Four selected approach paths are smoothed and given a consistent classroom lane width. Landmark meshes are artist models based on mapped positions.

## Regenerate

From the project root, use Python 3.12 or later with wheels available for Shapely and run the commands below. The builder uses cached PBFs if present and fetches the nine pinned tiles otherwise. The cache can be passed as the first argument.

```sh
python3 -m venv .venv-map
.venv-map/bin/pip install -r scripts/requirements-westminster.txt
.venv-map/bin/python scripts/westminster-map.py
npm run build:web
```
