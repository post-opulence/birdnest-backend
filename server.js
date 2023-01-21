
const cron = require('node-cron');
const axios = require('axios');
const { XMLParser} = require("fast-xml-parser")
const { Client } = require('pg');
require('dotenv').config()

const parser = new XMLParser();
const client = new Client({
    connectionString: process.env.CONNECTION_STRING,
});
client.connect()
  .then(() => {
    console.log('Connection established.');
  })
  .catch(err => {
    console.error('Connection Error: ', err);
  });

async function storeData(drone, pilot) {
    try {
      const existingDrone = await client.query(`SELECT * FROM drones WHERE serial_number = $1`, [drone.serialNumber]);
      const distance = Math.round(Math.sqrt(Math.pow(drone.positionX - 250000, 2) + Math.pow(drone.positionY - 250000, 2)) / 1000);
      const serial_number = drone.serialNumber;
      const position_x = parseFloat(drone.positionX);
      const position_y = parseFloat(drone.positionY);
      const first_seen = new Date(pilot.createdDt).toISOString();
      const pilot_id = pilot.pilotId
      const first_name = pilot.firstName
      const last_name = pilot.lastName
      const phone_number = pilot.phoneNumber
      const email = pilot.email
      if (existingDrone.rows.length > 0) {
        // The drone is already in the database, so we just need to update the data
        await client.query(`UPDATE drones SET 
                  position_x = $1, 
                  position_y = $2, 
                  distance = $3, 
                  last_seen = now() 
                  WHERE serial_number = $4`, [position_x, position_y, distance, serial_number]);
      } else {
        // The drone is not in the database, so we need to insert it
        await client.query(`INSERT INTO drones (
                  serial_number, 
                  position_x, 
                  position_y, 
                  distance,  
                  first_seen,
                  last_seen,
                  pilot_id,
                  first_name, 
                  last_name,
                  phone_number,
                  email
              ) VALUES ($1, $2, $3, $4, to_timestamp($5,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), now(), $6, $7, $8, $9, $10)`, [serial_number, position_x, position_y, distance, first_seen, pilot_id, first_name, last_name, phone_number, email]);  
        }
    } catch (error) {
        console.error(error);
    }
}

// Fetch drone data with proper headers to avoid CORS errors
async function fetchDrones() {
    const xmlData = await axios.get('https://assignments.reaktor.com/birdnest/drones', {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/xml'
        }
    });
    // Use fast-xml-parser to parse the XML data into JSON
    const parsedData = parser.parse(xmlData.data)
    const data = parsedData.report.capture.drone
    return data}

// Fetch pilot data with proper headers to avoid CORS errors

async function fetchPilot(serialNumber) {
    const response = await axios.get(`https://assignments.reaktor.com/birdnest/pilots/${serialNumber}`, {
         headers: {
             'Access-Control-Allow-Origin': '*',
             'Content-Type': 'application/json'
            }            
     })
     const data = response.data
     return data
}

// Schedule a task to fetch drone data every 2 seconds
cron.schedule('*/2 * * * * *', async () => {
    const drones = await fetchDrones();
    const violatingDrones = drones.filter(drone => {
        const distance = (Math.sqrt(Math.pow(drone.positionX - 250000, 2) + Math.pow(drone.positionY - 250000, 2)))/1000;
        if (distance <= 100) {}
        return distance <= 100;
    })
    // iterate over violatingDrones and fetch pilot data
    for (let drone of violatingDrones) {
        const serialNumber = drone.serialNumber
        const pilot = await fetchPilot(serialNumber);
        storeData(drone, pilot);
    }
});