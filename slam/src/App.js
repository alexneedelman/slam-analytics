
import logo from './logo.png';
import './App.css';
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import solver from 'javascript-lp-solver' 

function App() {
  const [csvData, setCsvData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('All'); 
  const [optimizedLineup, setOptimizedLineup] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [disabledPlayers, setDisabledPlayers] = useState(new Set());
  const [numLineups, setNumLineups] = useState(1);
  const [areAllPlayersEnabled, setAreAllPlayersEnabled] = useState(true);

  useEffect(() => {
    const fetchCSV = async () => {
      const response = await fetch('current.csv');
      const reader = response.body.getReader();
      const result = await reader.read();
      const decoder = new TextDecoder('utf-8');
      const csv = decoder.decode(result.value);
      const parsed = Papa.parse(csv, { header: true });
      handleCSVUpload(parsed.data);
    };

    fetchCSV();
  }, []);

  useEffect(() => {
    // Count the number of players by position
    const positionCounts = {};
    csvData.forEach(player => {
      const position = player.Position;
      if (!positionCounts[position]) {
        positionCounts[position] = 0;
      }
      positionCounts[position] += 1;
    });
  
    console.log('Position Counts:', positionCounts);
  }, [csvData]);
  

  const handlePositionChange = (newPosition) => {
    setSelectedPosition(newPosition);
  };

  const toggleAllPlayers = () => {
    setAreAllPlayersEnabled(!areAllPlayersEnabled);
    if (areAllPlayersEnabled) {
      setDisabledPlayers(new Set(csvData.map(player => player.ID)));
    } else {
      setDisabledPlayers(new Set());
    }
  };
  

  const handleNumLineupsChange = (e) => {
    let value = e.target.value;
  
    if (value === '' || value <= 0) {
      value = '';
    }

    if (value > 200 ) {
      value = 200;
    }
  
    setNumLineups(value);
  };

  const togglePlayer = (playerID) => {
    setDisabledPlayers(prevState => {
      const newState = new Set(prevState);
      if (newState.has(playerID)) {
        newState.delete(playerID);
      } else {
        newState.add(playerID);
      }
      return newState;
    });
  };

  const handleCSVUpload = (data) => {
    const updatedData = data.map(player => ({
      ...player,
      Value: (parseFloat(player.Projection) / (parseFloat(player.Salary) / 1000)).toFixed(2)
    }));
    
    setDisabledPlayers(new Set());  // Initialize to an empty set to enable all players by default
    setCsvData(updatedData);
  };

  const handleOptimizeClick = () => {
    setIsOptimizing(true);
    setOptimizedLineup([])
    setTimeout(() => {
      handleOptimize();
      setIsOptimizing(false);
    }, 0);
  };

  const handleOptimize = async () => {
    let lineups = [];
    let playerPool = csvData.filter(player => !disabledPlayers.has(player.ID));
  
    if (!numLineups) {
      console.log('Number of lineups not set');
      return;
    }
  
    // Generate 'numLineups' lineups
    for (let i = 0; i < numLineups; i++) {
      let optimizedData = optimizeLineup(playerPool);

      console.log(optimizedData)
  
      // Check if the lineup is complete and has all positions
      if (isLineupComplete(optimizedData)) {
        lineups.push(optimizedData);
      } else {
        console.log('Incomplete lineup');
        // If the lineup is incomplete, you can handle it as needed
        // For now, let's just break the loop
        break;
      }
    }
  
    // Remove players from the player pool based on the selected lineups
    lineups.forEach(lineup => {
      lineup.forEach(player => {
        playerPool = playerPool.filter(p => p.ID !== player.ID);
      });
    });
  
    // Now, you can use the 'lineups' array, and it should contain exactly 8 players in each lineup
    setOptimizedLineup(lineups);
  };
  
  
      
// Check if the lineup is complete
const isLineupComplete = (lineup) => {
  if (lineup.length !== 8) return false;

  const positions = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "DST"];
  const lineupPositions = lineup.map(player => player.Position);

  for (const pos of positions) {
    if (!lineupPositions.includes(pos)) return false;
  }

  return true;
};

const optimizeLineup = (players) => {
  const model = {
    optimize: "Projection",
    opType: "max",
    constraints: {
      Salary: { max: 30000 },
      QB: { min: 1, max: 1 },
      RB: { min: 1, max: 1 },
      WR: { min: 1, max: 1 },
      TE: { min: 1, max: 1 },
      DST: { min: 1, max: 1 },
      TotalPlayers: { equal: 5 } // Exactly 8 players in the lineup
    },
    variables: {},
    ints: {} // Declare a property to hold integer variables
  };

  players.forEach((player, i) => {
    model.variables[i] = {
      Projection: parseFloat(player.Projection),
      Salary: parseInt(player.Salary),
      Selected: 1, // Ensure the player is selected (always 1)
      QB: player.Position === 'QB' ? 1 : 0,
      RB: player.Position === 'RB' ? 1 : 0,
      WR: player.Position === 'WR' ? 1 : 0,
      TE: player.Position === 'TE' ? 1 : 0,
      DST: player.Position === 'DST' ? 1 : 0,
      TotalPlayers: 1, // Each player counts as one towards the total
      binary: true
    };
    model.ints[i] = 1; // Indicate that this variable should be an integer
  });
  
  let result = solver.Solve(model);

  console.log(result);

  if (result.feasible) {
    const selectedPlayers = [];
    players.forEach((player, i) => {
      if (result[i] === 1) {
        selectedPlayers.push(player);
      }
    });

    return selectedPlayers;
  } else {
    console.error("ILP Solve could not find a solution");
    return null;
  }
};

    
    
  const CSVUploader = ({ onUpload }) => {
    const hiddenFileInput = React.useRef(null);

    const handleClick = () => {
      hiddenFileInput.current.click();
    };
  
    const handleFileUpload = (event) => {
      const file = event.target.files[0];
      Papa.parse(file, {
        complete: (result) => {
          const filteredData = result.data.filter(player => 
            parseFloat(player.Projection) > 0 && 
            parseFloat(player.Projection) >= 10
          );
          onUpload(filteredData);
        },
        header: true
      });
    };
  
    return (
      <div style={{ margin: '20px' }}>
        <button onClick={handleClick} className="custom-file-button">
          Upload Data
        </button>
        <input
          type="file"
          ref={hiddenFileInput}
          onChange={handleFileUpload}
          style={{display: 'none'}}
          accept=".csv"
        />
      </div>
    );
 
  };


    const OptimizerButton = ({ onOptimize }) => {
      return (
        <div >
              <button 
                onClick={onOptimize} 
                className={`button-optimize ${isOptimizing ? 'disabled' : ''}`}
                disabled={isOptimizing}
                style={{ display: isOptimizing ? 'none' : 'null' }}
              >
                {`Optimize ${numLineups} ${numLineups > 1 ? 'Lineups' : 'Lineup'}`}
              </button>
        </div>
      );
    };

    const LineupDisplay = ({ lineup }) => {
      return (
        <div style={{ margin: '20px', display: 'flex', flexWrap: 'wrap' }}>
          {lineup.map((singleLineup, lineupIndex) => {
            // Calculate total points and total salary for the lineup
            const totalPoints = singleLineup.reduce((acc, player) => acc + parseFloat(player.Projection), 0).toFixed(2);
            const totalSalary = singleLineup.reduce((acc, player) => acc + parseInt(player.Salary, 10), 0);
    
            return (
              <div key={lineupIndex} style={{ flex: '0 0 calc(33% - 20px)', margin: '5px', border: "2px solid black"}}>
                <h2>Lineup {lineupIndex + 1}</h2>
                <div>Total Points: {totalPoints}</div>
                <div>Total Salary: ${totalSalary}</div>
                <hr></hr>
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {singleLineup.map((player, index) => (
                    <li key={index} style={{ marginBottom: '10px' }}>
                      {`${player.Position}: ${player.Name} (${player.Projection} points, $${player.Salary})`}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      );
    };
    
    
    



    const Table = ({ data }) => {
      // Filter data based on the selected position
      // Filter data based on the selected position
      let filteredData = selectedPosition === 'All' ? data : data.filter(row => row.Position === selectedPosition);
      filteredData.sort((a, b) => parseFloat(b.Value) - parseFloat(a.Value));

    
      return (
        <div style={{ margin: '20px', overflowX: 'auto' }}>
      <div style={{ display: 'flex',marginBottom:"15px" }}>
        <div className="table-header" onClick={() => handlePositionChange('All')}>All</div>
        <div className="table-header" onClick={() => handlePositionChange('QB')}>QB</div>
        <div className="table-header" onClick={() => handlePositionChange('RB')}>RB</div>
        <div className="table-header" onClick={() => handlePositionChange('WR')}>WR</div>
        <div className="table-header" onClick={() => handlePositionChange('TE')}>TE</div>
        <div className="table-header" onClick={() => handlePositionChange('DST')}>DST</div>
        <button onClick={toggleAllPlayers} className="button-optimize" style={{marginLeft:"15px"}}>
          {!areAllPlayersEnabled ? "Enable All Players" : "Disable All Players"}
        </button>
      </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                {/* Add table headers based on the CSV structure */}
                <th>Position</th>
                <th>Name</th>
                <th>Team</th>
                <th>Salary</th>
                <th>Projection</th>
                <th>Value</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, index) => (
                <tr key={index}>
                  {/* Fill in table data based on the CSV structure */}
                  <td>{row.Position}</td>
                  <td>{row.Name}</td>
                  <td>{row.TeamAbbrev}</td>
                  <td>{row.Salary}</td>
                  <td>{row.Projection}</td>
                  <td>{row.Value}</td>
                  <td>
                    <input
                       type="checkbox"
                       checked={!disabledPlayers.has(row.ID)}
                       onChange={() => togglePlayer(row.ID)}
                     />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };
    

    const handleReset = () => {
      setCsvData([]);
      setOptimizedLineup([]);
    };


  return (
    <div className="App">
    <div className="logo-container">
      <img src={logo} alt="Slam" className="header-logo" />
      <div className="header">Draftkings NFL Lineup Optimizer</div>
    </div>
    <div className="container">
      {!csvData.length && <CSVUploader onUpload={handleCSVUpload} />}
      <div className="header" style={{display: isOptimizing ? 'block' : 'none'}}>Solving...</div>
       {csvData.length > 0 && (
        <div className="button-container">
          <input 
            placeholder='Enter # of Lineups'
            type="number" 
            min="1" 
            max="200"
            value={numLineups} 
            onChange={handleNumLineupsChange} 
            style={{ display: isOptimizing ? 'none' : 'block', padding: '10px', width:"150px", fontSize: '16px', marginRight: '10px' }} 
          />

            <OptimizerButton  onOptimize={handleOptimizeClick} />
          <button id="reset" className="button"
                style={{ display: isOptimizing ? 'none' : 'block' }} onClick={handleReset}>Upload Data</button>
        </div>
      )}
      {optimizedLineup.length > 0 && <LineupDisplay lineup={optimizedLineup} />}
      {csvData.length > 0 && <Table data={csvData} />}
    </div>
  </div>
  );
}

export default App;
