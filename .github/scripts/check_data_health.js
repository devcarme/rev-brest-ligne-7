const fs = require('fs');
const path = require('path');

function checkDataHealth() {
  checkJsonFilesAreValid();
  checkGeoJsonDataHealth();
}

function checkJsonFilesAreValid(directory = 'content') {
  fs.readdirSync(directory).forEach(file => {
    const filePath = path.join(directory, file);

    if (fs.statSync(filePath).isDirectory()) {
      checkJsonFilesAreValid(filePath);
    } else if (file.endsWith('.json')) {
      try {
        JSON.parse(fs.readFileSync(filePath));
        console.log(`JSON file is valid: ${filePath}`);
      } catch (error) {
        console.error(`Invalid JSON file: ${filePath}`);
        process.exit(1);
      }
    }
  });
}

function checkGeoJsonDataHealth() {
  const allLineStrings = [];
  fs.readdirSync('content/voies-lyonnaises').forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join('content/voies-lyonnaises', file);
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        const geojson = JSON.parse(content);

        if (geojson.type === 'FeatureCollection') {
          for (const feature of geojson.features) {
            if (feature.geometry.type === 'LineString') {
              allLineStrings.push(feature);
              // 2 - check if all properties are present
              const properties = feature.properties || {};
              const requiredKeys = ['line', 'color', 'name', 'status'];
              for (const key of requiredKeys) {
                if (!properties.hasOwnProperty(key)) {
                  console.error(`Missing key '${key}' in LineString properties of file: ${filePath}`);
                  process.exit(1);
                }
              }

              // 3 - check if status is valid
              const validStatus = ['done', 'wip', 'planned', 'postponed', 'unknown', 'variante', 'variante-postponed'];
              if (!validStatus.includes(properties.status)) {
                console.error(`Invalid status '${properties.status}' in LineString properties of file: ${filePath}`);
                process.exit(1);
              }

              // 4 - Check if all done section have a doneAt property
              if (properties.status === 'done') {
                if (!properties.hasOwnProperty('doneAt')) {
                  console.error(`Missing key 'doneAt' in VL ${properties.line}, tronçon: ${properties.name}`);
                  process.exit(1);
                }

                const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
                if (!dateRegex.test(properties.doneAt)) {
                  console.error(
                    `Invalid doneAt format '${properties.doneAt}' in VL ${properties.line}, tronçon: ${properties.name}`
                  );
                  process.exit(1);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error parsing GeoJSON file: ${filePath}`);
        process.exit(1);
      }
    }
  });

  // 5 - Check if all properties.id exists at least twice
  const idsCount = allLineStrings.reduce((count, lineString) => {
    const id = lineString.properties.id;
    count[id] = (count[id] || 0) + 1;
    return count;
  }, {});
  for (const id in idsCount) {
    if (idsCount[id] < 2) {
      console.error(`Missing LineString with id '${id}'`);
      process.exit(1);
    }
  }
}

checkDataHealth();