This is the backend for my [birdnest](https://github.com/post-opulence/birdnest) project. It's built with Javascript and runs on Node.js.
More information regarding this project can be found [here](https://web.archive.org/web/20221220105911/https://assignments.reaktor.com/birdnest/).

## Description

This simple script fetches data from Reaktor's API then sorts the drones data based on their distance from the bird's nest. If a drone is found violating the No Drone Zone (NDZ), the drone's serial number is used to fetch its pilot's information. The violating drone data and corresponding pilot info is then stored in a Supabase database. The database is setup to delete data 10 mins after it has been inserted or updated. 

## How it works.

This script first connects to a Supabase database using the pg module. 

It then fetches data from Reaktor using Axios with the following headers:

``` 
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/xml'
        }
```

This is done to overcome the CORS restrictions of Reaktor's API. Using "'Access-Control-Allow-Origin': '*'" on its own isn't sufficient to bypass the restrictions, it is also necessary to specify the content type (XML for the drones and JSON for the pilots). The fetched data is then parsed from XML to JSON using fast-xml-parser. 

The drone data is then filtered according to their distance to the bird's nest. Drones found to be inside the NDZ are then returned as violatingDrones and their respective pilot information is fetched. Their data is then stored on the database with the pg module. 
The storing function first checks if a drone already exists within the database based on its serial number. If it already exists, it updates its positions, last_seen and distance. If the drone doesn't already exist in the database, then all the relevant data is inserted in the database. Error handling is also included to catch and log any issues that may occur during the data retrieval and storage process.

The following SQL query was ran on the database to only store the data for 10 minutes since the drone was last seen.  

``` 
CREATE OR REPLACE FUNCTION delete_stale_drones()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM drones WHERE last_seen < NOW() - INTERVAL '10 minutes';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delete_stale_drones_trigger
AFTER INSERT OR UPDATE ON drones
EXECUTE FUNCTION delete_stale_drones();
``` 

Since the drone data updates every 2 seconds, the script runs inside a node-cron task scheduled to run every 2 seconds. Being a simple script, there shouldn't be any issue running it every 2 seconds with a cron task. 

## Modules Used 

    node-cron
    axios
    fast-xml-parser
    pg
    dotenv    

## How to Run Locally

Clone the repository

```git clone https://github.com/post-opulence/birdnest-backend.git```

Install the dependencies

```npm install```

Create a .env file in the root directory with the correct credentials:

```CONNECTION_STRING=postgresql://username:password@host:port/database```

Start the server

```npm start```
