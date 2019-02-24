// jshint esversion: 6

// const apiUrl = 'https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A120%5D%3B%0Aarea%5Bname%3D%22Essen%22%5D%5Badmin_level%3D6%5D-%3E.a%3B%0A%28%0A%20%20node%28area.a%29%5B%22amenity%22%3D%22recycling%22%5D%3B%0A%20%20%29%3B%0Aout%20meta%3B'
const apiUrl = './data/features.json'

const req = new XMLHttpRequest()
req.onreadystatechange = () => {
  if (req.readyState == 4 && req.status == 200) {
    const data = JSON.parse(req.responseText)
    renderMap(data)
  }
}
req.open("GET", apiUrl, true)
req.send()

L.RecyclingIcon = L.SegmentedCircleIcon.extend({
  initialize: function (options) {
    options.segments = this._generateSegmentsFromTypes(options.types)
    options.className = 'segmented-circle-icon'
    // console.log(options.segments);
    let segmentCount = options.segments.length
    options.className += ` segmented-circle-icon--${segmentCount}-segments`
    L.SegmentedCircleIcon.prototype.initialize.call(this, options)
  },
  _generateSegmentsFromTypes: (types) => {
    let keys = Object.keys(types)
    console.log(types, keys);
    return keys.map(type => {
      return {
        className: `segment segment--${type}`,
        weight: types[type]
      }
    })
  }
})
L.recyclingIcon = (coords, options) => {
  return new L.RecyclingIcon(coords, options)
}

L.RecyclingMarker = L.Marker.extend({
  initialize: function (coords, options) {
    options.icon = L.recyclingIcon({
      types: options.types,
      radius: options.radius || 12
    })
    L.Marker.prototype.initialize.call(this, coords, options)
  }
})
L.recyclingMarker = (coords, options) => {
  return new L.RecyclingMarker(coords, options)
}

const renderMap = ({elements, generator, osm3s}) => {

  const recyclingMap = L.map('recycling-map').setView([51.46, 7.02], 13)
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  // L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18
  }).addTo(recyclingMap)

  L.control.locate().addTo(recyclingMap)

  // get features
  const features = getGeoJSONLayer(elements).features

  const getTypes = tags => {
    let props = ['recycling:glass', 'recycling:glass_bottles', 'recycling:paper', 'recycling:clothes', 'recycling:shoes'];
    return props.filter((prop) => {
      return tags.properties[prop] === 'yes'
    }).map((prop) => {
      let identifier = prop.slice((prop.indexOf(':') + 1))
      // differentiation between glass and glas_bottles unclear, hence we treat them alike
      // see https://wiki.openstreetmap.org/wiki/DE:Tag:amenity%3Drecycling
      if (identifier === 'glass_bottles') {
        identifier = 'glass'
      }

      if (identifier === 'shoes') {
        identifier = 'clothes'
      }

      return identifier
    }).filter((prop, index, arr) => {
      return (arr.indexOf(prop) === index)
    })
  }

  let geoJsonLayer = L.geoJSON(features, {
    pointToLayer: (f, coords) => {
      const types = getTypes(f)
      return L.recyclingMarker(coords, { types: types, radius: 8 })
    }
  })

  const createClusterMarkerIcon = cluster => {
    let childMarkers = cluster.getAllChildMarkers()
    let typesInCluster = {}
    let totalTypes = 0;

    childMarkers.forEach(child => {
      let types = getTypes(child.feature)
      types.forEach(type => {
        if (!typesInCluster[type]) {
          typesInCluster[type] = 1
        } else {
          typesInCluster[type]++;
        }
        totalTypes++;
      })
    })

    for (let type in typesInCluster) {
      typesInCluster[type] = typesInCluster[type] / totalTypes
    }

    return L.recyclingIcon( { radius: 12, types: typesInCluster } )
  }

  let markerCluster = L.markerClusterGroup( {
    iconCreateFunction: createClusterMarkerIcon,
    disableClusteringAtZoom: 16,
    showCoverageOnHover: true,
    spiderfyOnMaxZoom: false,
    maxClusterRadius: 60
  } )

  geoJsonLayer.addTo(recyclingMap)

  // markerCluster
  //   .addLayer(geoJsonLayer)
  //   .addTo(recyclingMap)
}

// convert overpass data to geojson spec
const getGeoJSONLayer = elements => {

  const layer = {
    type: 'FeatureCollection',
    features: []
  }

  elements.map(e => {
    layer.features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [e.lon, e.lat]
      },
      properties: e.tags
    })
  })

  return layer

}
