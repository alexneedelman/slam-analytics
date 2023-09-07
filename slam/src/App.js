import logo from './logo.png';
import './App.css';
import React, { useState } from 'react';
import Papa from 'papaparse';
import solver from 'javascript-lp-solver' 

function App() {
  const [csvData, setCsvData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('All'); 
  const [optimizedLineup, setOptimizedLineup] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [disabledPlayers, setDisabledPlayers] = useState(new Set());
  const [numLineups, setNumLineups] = useState('');
  const [areAllPlayersEnabled, setAreAllPlayersEnabled] = useState(false);

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
    
    const allPlayerIds = new Set(updatedData.map(player => player.ID));
    setDisabledPlayers(allPlayerIds);
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
  
    
    console.log('Player Pool:', playerPool); // Debugging statement
  
    if (!numLineups) {
      console.log('Number of lineups not set'); // Debugging statement
      return;
    }
  
    // Generate 'numLineups' lineups
    for (let i = 0; i < numLineups; i++) {
      console.log('Optimizing Lineup: #', i + 1 + "..."); // Debugging statement
      let optimizedData = optimizeLineup(playerPool);
      console.log('Optimized Data:', optimizedData); // Debugging statement
  
      // Check if the lineup is complete and has all positions
      if (isLineupComplete(optimizedData)) {
        // Update the state to reflect the new lineup
        lineups.push(optimizedData);
        setOptimizedLineup([...lineups]); // This will cause the component to re-render
      } else {
        console.log('Incomplete lineup'); // Debugging statement
        // Exit the loop if a complete lineup couldn't be formed
        break;
      }
  
      // Remove the lowest-scoring player from the lineup
      const lowestScoringPlayer = optimizedData.reduce((acc, player) => 
        !acc || player.Projection < acc.Projection ? player : acc, 
        null
      );
      playerPool = playerPool.filter(player => player.ID !== lowestScoringPlayer.ID);
    }  
  };
  
      
      
    // Check if the lineup is complete
    const isLineupComplete = (lineup) => {
      if (lineup.length !== 9) return false;

      const positions = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "DST"];
      const lineupPositions = lineup.map(player => player.Position);

      for (const pos of positions) {
        if (pos === "FLEX") {
          if (!lineupPositions.some(p => ["RB", "WR", "TE"].includes(p))) return false;
        } else {
          if (!lineupPositions.includes(pos)) return false;
        }
      }

      return true;
    };
    const optimizeLineup = (players) => {
      const model = {
        optimize: "Projection", // Objective: Maximize Projection
        opType: "max",          // Set the optimization type to maximize
        constraints: {
          Salary: { max: 50000 }, // Salary constraint: Total salary <= 50000
        },
        variables: {},
      };
    
      const positions = ["QB", "RB", "WR", "TE", "DST", "FLEX"];
      
      // Create binary decision variables for each player position
      positions.forEach((pos) => {
        for (let i = 0; i < players.length; i++) {

          model.variables[`${pos}_${i}`] = { Projection: players[i].Projection, Salary: players[i].Salary, binary: true };
        }
      });
    
      // Add position constraints (e.g., QB = 1, RB = 2, WR = 3, TE = 1, DST = 1)
      positions.forEach((pos) => {
        const count = players.filter((player) => player.Position === pos).length;
        model.constraints[pos] = { equals: count };
      });
    
      // Add FLEX constraint (FLEX can be RB, WR, or TE)
      model.constraints.FLEX = { equals: 1 };
    
      const result = solver.Solve(model);
    
      console.log(result);
    
      if (result.feasible) {
        // Extract selected players with decision variables >= 1
        const selectedPlayers = [];
        positions.forEach((pos) => {
          for (let i = 0; i < players.length; i++) {
            const varName = `${pos}_${i}`;
            if (result[varName] === 1) {
              selectedPlayers.push(players[i]);
            }
          }
        });
    
        // Check if the selected players form a complete lineup
        if (isLineupComplete(selectedPlayers)) {
          return selectedPlayers;
        } else {
          console.error("Incomplete lineup");
          return null;
        }
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
            parseFloat(player.Projection) >= 5
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
          <button className="button"
                style={{ display: isOptimizing ? 'none' : 'block' }} onClick={handleReset}>Reset</button>
        </div>
      )}
      {optimizedLineup.length > 0 && <LineupDisplay lineup={optimizedLineup} />}
      {csvData.length > 0 && <Table data={csvData} />}
    </div>
  </div>
  );
}

export default App;
