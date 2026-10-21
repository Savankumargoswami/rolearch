# Worker data

`cities.tsv`: every populated place with 15,000+ people, from [GeoNames](https://www.geonames.org/)
(`cities15000` and `admin1CodesASCII`), licensed CC BY 4.0. Used to give jobs map coordinates
(`geo.city_coords`). The site credits GeoNames in its footer.

To refresh it, download `cities15000.zip` and `admin1CodesASCII.txt` from
https://download.geonames.org/export/dump/ and rebuild with the same columns:
name (ASCII, lower case), country, admin1 code, admin1 name, lat, lon, population.
