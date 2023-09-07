import logo from "./logo.png";
import "./App.css";
import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import solver from "javascript-lp-solver";

function App() {
  const [csvData, setCsvData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [optimizedLineup, setOptimizedLineup] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [disabledPlayers, setDisabledPlayers] = useState(new Set());
  const [numLineups, setNumLineups] = useState(1);
  const [areAllPlayersEnabled, setAreAllPlayersEnabled] = useState(true);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [editedProjection, setEditedProjection] = useState({});
  const [editingId, setEditingId] = useState(null);

  const [sortCriteria, setSortCriteria] = useState({
    field: "Salary",
    direction: "desc",
  });

  useEffect(() => {
    const fetchCSV = async () => {
      try {
        const response = await fetch(
          "https://sports-test-bucket-2.s3.amazonaws.com/current.csv"
        );
        if (!response.ok) {
          // check if response is ok (status in the range 200-299)
          console.log("Network response was not ok", response);
          return;
        }
        const reader = response.body.getReader();
        const result = await reader.read();
        const decoder = new TextDecoder("utf-8");
        const csv = decoder.decode(result.value);
        const parsed = Papa.parse(csv, { header: true });
        handleCSVUpload(parsed.data);
      } catch (error) {
        console.log("Fetch error:", error);
      }
    };

    fetchCSV();
  }, []);

  const duplicatePlayers = (data, originalPosition, newPositions) => {
    const subset = data.filter(
      (player) => player.Position === originalPosition
    );
    let duplicatedData = [];
    newPositions.forEach((newPosition) => {
      const temp = subset.map((player) => ({
        ...player,
        Position: newPosition,
      }));
      duplicatedData = [...duplicatedData, ...temp];
    });
    return duplicatedData;
  };

        const generateDraftKingsCSV = () => {
          let csvContent = "QB,RB,RB,WR,WR,WR,TE,FLEX,DST\n"; // header
        
          optimizedLineup.forEach((lineup) => {
            const lineupObj = {};
            lineup.forEach((player) => {
              lineupObj[player.Position] = player.ID;
            });
        
            const row = [
              lineupObj["QB"],
              lineupObj["RB1"],
              lineupObj["RB2"],
              lineupObj["WR1"],
              lineupObj["WR2"],
              lineupObj["WR3"],
              lineupObj["TE"],
              lineupObj["FLEX"],
              lineupObj["DST"],
            ].join(",");
        
            csvContent += row + "\n";
          });
        
          const blob = new Blob([csvContent], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", "draftkings_lineups.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };
        

  const handleCSVUpload = (data) => {
    // Define the new pseudo-positions
    const newPositionsMap = {
      RB: ["RB1", "RB2", "FLEX"],
      WR: ["WR1", "WR2", "WR3", "FLEX"],
      TE: ["TE", "FLEX"],
    };

    // Filter data based on projections and position
    const filteredData = data.filter((player) => {
      const projection = parseFloat(player.Projection);
      if (player.Position === "TE" || player.Position === "DST") {
        return projection >= 5;
      }
      return projection >= 8;
    });

    let duplicatedData = [];
    for (const [originalPosition, newPositions] of Object.entries(
      newPositionsMap
    )) {
      const duplicates = duplicatePlayers(
        filteredData,
        originalPosition,
        newPositions
      );
      duplicatedData = [...duplicatedData, ...duplicates];
    }

    const updatedData = [...filteredData, ...duplicatedData].map((player) => ({
      ...player,
      Value: (
        parseFloat(player.Projection) /
        (parseFloat(player.Salary) / 1000)
      ).toFixed(2),
    }));

    setDisabledPlayers(new Set()); // Initialize to an empty set to enable all players by default
    setCsvData(updatedData);
  };

  useEffect(() => {
    // Count the number of players by position
    const positionCounts = {};
    csvData.forEach((player) => {
      const position = player.Position;
      if (!positionCounts[position]) {
        positionCounts[position] = 0;
      }
      positionCounts[position] += 1;
    });

    console.log("Position Counts:", positionCounts);
  }, [csvData]);

  const handlePositionChange = (newPosition) => {
    setSelectedPosition(newPosition);
  };

  const handleProjectionChange = (id, newProjection) => {
    setEditedProjection({ ...editedProjection, [id]: newProjection });
  };

  const handleProjectionBlur = (id) => {
    if (editedProjection[id]) {
      // Update csvData here
      const newProjection = editedProjection[id];
      const updatedCsvData = csvData.map((player) => {
        if (player.ID === id) {
          const newPlayer = { ...player };
          newPlayer.Projection = newProjection;
          newPlayer.Value = (
            parseFloat(newProjection) /
            (parseFloat(player.Salary) / 1000)
          ).toFixed(2);
          return newPlayer;
        }
        return player;
      });
  
      setCsvData(updatedCsvData);
    }
    setEditingId(null);  // Clear editingId
  };
  
  
  

  const toggleAllPlayers = () => {
    setAreAllPlayersEnabled(!areAllPlayersEnabled);
    if (areAllPlayersEnabled) {
      setDisabledPlayers(new Set(csvData.map((player) => player.ID)));
    } else {
      setDisabledPlayers(new Set());
    }
  };

  const handleNumLineupsChange = (e) => {
    let value = e.target.value;

    if (value === "" || value <= 0) {
      value = "";
    }

    if (value > 200) {
      value = 200;
    }

    setNumLineups(value);
  };

  const togglePlayer = (playerID) => {
    setDisabledPlayers((prevState) => {
      const newState = new Set(prevState);
      const targetPlayer = csvData.find((player) => player.ID === playerID);
      const targetPlayerKey = `${targetPlayer.Name}-${targetPlayer.TeamAbbrev}`;

      // Find all duplicates of the target player
      const duplicates = csvData.filter(
        (player) => `${player.Name}-${player.TeamAbbrev}` === targetPlayerKey
      );

      if (newState.has(playerID)) {
        // If the player is already disabled, enable all duplicates
        duplicates.forEach((player) => newState.delete(player.ID));
      } else {
        // Otherwise, disable all duplicates
        duplicates.forEach((player) => newState.add(player.ID));
      }
      return newState;
    });
  };

  const handleOptimizeClick = () => {
    setIsOptimizing(true);
    setOptimizedLineup([]);
    setTimeout(() => {
      handleOptimize();
      setIsOptimizing(false);
    }, 0);
  };

  const handleOptimize = async () => {
    let lineups = [];
    let playerPool = csvData.filter(
      (player) => !disabledPlayers.has(player.ID)
    );

    if (!numLineups) {
      console.log("Number of lineups not set");
      return;
    }

    // Generate 'numLineups' lineups
    for (let i = 0; i < numLineups; i++) {
      let optimizedData = optimizeLineup(playerPool);

      // Check if the lineup is complete and has all positions
      if (isLineupComplete(optimizedData)) {
        lineups.push(optimizedData);

        // Find the player with the highest projection
        let bestPlayer = optimizedData.reduce(
          (max, player) =>
            parseFloat(player.Projection) > parseFloat(max.Projection)
              ? player
              : max,
          optimizedData[0]
        );

        // Remove the best player and its duplicates from the player pool
        const bestPlayerKey = `${bestPlayer.Name}-${bestPlayer.TeamAbbrev}`;
        playerPool = playerPool.filter(
          (player) => `${player.Name}-${player.TeamAbbrev}` !== bestPlayerKey
        );
      } else {
        console.log("Incomplete lineup");
        // If the lineup is incomplete, you can handle it as needed
        // For now, let's just break the loop
        break;
      }
    }

    // Now, you can use the 'lineups' array, and it should contain unique players in each lineup
    setOptimizedLineup(lineups);
    setOptimizationComplete(true); // Set to true after optimization
  };

  // Check if the lineup is complete
  const isLineupComplete = (lineup) => {
    if (lineup.length !== 9) return false; // Updated to 9 players

    const positions = [
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR2",
      "WR3",
      "TE",
      "FLEX",
      "DST",
    ]; // Updated positions
    const lineupPositions = lineup.map((player) => player.Position);

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
        Salary: { max: 50000 },
        QB: { min: 1, max: 1 },
        RB1: { min: 1, max: 1 },
        RB2: { min: 1, max: 1 },
        WR1: { min: 1, max: 1 },
        WR2: { min: 1, max: 1 },
        WR3: { min: 1, max: 1 },
        TE: { min: 1, max: 1 },
        FLEX: { min: 1, max: 1 },
        DST: { min: 1, max: 1 },
        TotalPlayers: { equal: 9 },
      },
      variables: {},
      ints: {}, // Declare a property to hold integer variables
    };

    const playerConstraints = {};

    players.forEach((player, i) => {
      model.variables[i] = {
        Projection: parseFloat(player.Projection),
        Salary: parseInt(player.Salary),
        Selected: 1,
        QB: player.Position === "QB" ? 1 : 0,
        RB1: player.Position === "RB1" ? 1 : 0,
        RB2: player.Position === "RB2" ? 1 : 0,
        WR1: player.Position === "WR1" ? 1 : 0,
        WR2: player.Position === "WR2" ? 1 : 0,
        WR3: player.Position === "WR3" ? 1 : 0,
        FLEX: player.Position === "FLEX" ? 1 : 0,
        TE: player.Position === "TE" ? 1 : 0,
        DST: player.Position === "DST" ? 1 : 0,
        TotalPlayers: 1,
        [player.ID]: 1, // Use ID as a unique key for each player to track selection
      };

      // Initialize or update the unique constraint for each player
      if (!playerConstraints[player.ID]) {
        playerConstraints[player.ID] = { max: 1 };
      }

      model.ints[i] = 1;
    });

    // Add the unique player constraints to the model
    model.constraints = { ...model.constraints, ...playerConstraints };

    let result = solver.Solve(model);

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
          const filteredData = result.data.filter(
            (player) => parseFloat(player.Projection) >= 7
          );
          onUpload(filteredData);
        },
        header: true,
      });
    };

    return (
      <div style={{ margin: "20px" }}>
        <button onClick={handleClick} className="custom-file-button">
          Upload Data
        </button>
        <input
          type="file"
          ref={hiddenFileInput}
          onChange={handleFileUpload}
          style={{ display: "none" }}
          accept=".csv"
        />
      </div>
    );
  };

  const OptimizerButton = ({ onOptimize }) => {
    return (
      <div>
        <button
          onClick={() => {
            if (optimizationComplete) {
              window.location.reload(); // Reload the page
            } else {
              onOptimize();
            }
          }}
          className={`button-optimize ${isOptimizing ? "disabled" : ""}`}
          disabled={isOptimizing}
          style={{ display: isOptimizing ? "none" : "null" }}
        >
          {optimizationComplete
            ? "Restart"
            : `Optimize ${numLineups} ${numLineups > 1 ? "Lineups" : "Lineup"}`}
        </button>
      </div>
    );
  };

  const positionsOrder = [
    "QB",
    "RB1",
    "RB2",
    "WR1",
    "WR2",
    "WR3",
    "TE",
    "FLEX",
    "DST",
  ];
  const LineupDisplay = ({ lineup }) => {
    const isMobile = window.innerWidth <= 768;

    // Change flex style and font size based on the device
    const flexStyle = isMobile
    ? { flex: "0 0 100%", fontSize: "12px", margin: "2px" }
    : { flex: "0 0 calc(33% - 20px)", fontSize: "16px", margin: "5px" };

    const containerStyle = isMobile
    ? { margin: "10px", display: "flex", flexWrap: "wrap" }
    : { margin: "20px", display: "flex", flexWrap: "wrap" };

    return (
      <div style={containerStyle}>
      {lineup.map((singleLineup, lineupIndex) => {
          singleLineup.sort(
            (a, b) =>
              positionsOrder.indexOf(a.Position) -
              positionsOrder.indexOf(b.Position)
          );

          // Calculate total points and total salary for the lineup
          const totalPoints = singleLineup
            .reduce((acc, player) => acc + parseFloat(player.Projection), 0)
            .toFixed(2);
          const totalSalary = singleLineup.reduce(
            (acc, player) => acc + parseInt(player.Salary, 10),
            0
          );

          return (
            <div
              key={lineupIndex}
              style={{ ...flexStyle, border: "2px solid black" }}
            >
              <h2 style={{ fontSize: isMobile ? "14px" : "18px" }}>
                Lineup {lineupIndex + 1}
              </h2>
              <div>Total Points: {totalPoints}</div>
              <div>Total Salary: ${totalSalary}</div>
              <hr></hr>
              <ul style={{ listStyleType: "none", padding: 0 }}>
                {singleLineup.map((player, index) => (
                  <li key={index} style={{ marginBottom: "10px" }}>
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


  const Table = ({ data, optimizationComplete }) => {

    let filteredData =
      selectedPosition === "All"
        ? data
        : data.filter((row) => row.Position === selectedPosition);

    // Remove duplicates for table rendering
    const uniqueNames = new Set();
    filteredData = filteredData.filter((row) => {
      const uniqueKey = `${row.Name}-${row.TeamAbbrev}`;
      if (!uniqueNames.has(uniqueKey)) {
        uniqueNames.add(uniqueKey);
        return true;
      }
      return false;
    });

    const convertToCSV = () => {
      const header = [
        "Position",
        "Name",
        "Team",
        "Salary",
        "Projection",
        "Value",
      ];
      let csvContent = header.join(",") + "\n";

      data.forEach((row) => {
        const rowArray = [
          row.Position,
          row.Name,
          row.TeamAbbrev,
          row.Salary,
          row.Projection,
          row.Value,
        ];
        const rowString = rowArray.join(",");
        csvContent += rowString + "\n";
      });

      return csvContent;
    };

    const handleDownload = async () => {
      const response = await fetch(
        "https://sports-test-bucket-2.s3.amazonaws.com/current.csv"
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        "https://sports-bucket-nifty.s3.amazonaws.com/current.csv"
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const sortedData = [...filteredData].sort((a, b) => {
      const field = sortCriteria.field;
      const direction = sortCriteria.direction === "asc" ? 1 : -1;

      if (parseFloat(a[field]) < parseFloat(b[field])) return -1 * direction;
      if (parseFloat(a[field]) > parseFloat(b[field])) return 1 * direction;
      return 0;
    });

    // Add a function to handle sort selection
    const handleSortChange = (field) => {
      setSortCriteria((prev) => {
        const newDirection =
          prev.field === field && prev.direction === "desc" ? "desc" : "desc";
        return { field, direction: newDirection };
      });
    };

    return (
      <div style={{ margin: "20px", overflowX: "auto" }}>
      
        <div style={{ display: "flex", marginBottom: "15px" }}>
          <div>Sort:</div>
        </div>
        <div style={{ display: "flex", marginBottom: "15px" }}>
          <button
            type="button"
            className={`button-log ${
              sortCriteria.field === "Salary" ? "selected" : ""
            }`}
            onClick={() => handleSortChange("Salary")}
          >
            Salary
          </button>
          <button
            type="button"
            className={`button-log ${
              sortCriteria.field === "Projection" ? "selected" : ""
            }`}
            style={{marginLeft:"15px"}}
            onClick={() => handleSortChange("Projection")}
          >
            Projection
          </button>
          <button
            type="button"
            className={`button-log ${
              sortCriteria.field === "Value" ? "selected" : ""
            }`}
            style={{marginLeft:"15px"}}
            onClick={() => handleSortChange("Value")}
          >
            Value
          </button>
        </div>

        <div style={{ display: "flex", marginBottom: "15px" }}>
          <div>Positions:</div>
        </div>

        <div style={{ display: "flex", marginBottom: "15px" }}>
          <div
            className={`button-log ${
              selectedPosition === "All" ? "selected" : ""
            }`}
            onClick={() => handlePositionChange("All")}
          >
            All
          </div>
          <div
            className={`button-log ${
              selectedPosition === "QB" ? "selected" : ""
            }`}
            onClick={() => handlePositionChange("QB")}
            style={{marginLeft:"5px"}}
          >
            QB
          </div>
          <div
            className={`button-log ${
              selectedPosition === "RB" ? "selected" : ""
            }`}
            onClick={() => handlePositionChange("RB")}
            style={{marginLeft:"5px"}}
          >
            RB
          </div>
          <div
            className={`button-log ${
              selectedPosition === "WR" ? "selected" : ""
            }`}
            onClick={() => handlePositionChange("WR")}
            style={{marginLeft:"5px"}}
          >
            WR
          </div>
          <div
            className={`button-log ${
              selectedPosition === "TE" ? "selected" : ""
            }`}
            onClick={() => handlePositionChange("TE")}
            style={{marginLeft:"5px"}}
          >
            TE
          </div>
          <div
            className={`button-log ${
              selectedPosition === "DST" ? "selected" : ""
            }`}
            onClick={() => handlePositionChange("DST")}
            style={{marginLeft:"5px"}}
          >
            DST
          </div>
        </div>

        <div style={{ display: "flex", marginBottom: "15px" }}>
          <div>Tools:</div>
        </div>
        <div style={{ display: "flex", marginBottom: "15px" }}>
        {optimizationComplete && (
        <button 
          className="button-optimize"
          onClick={generateDraftKingsCSV} 
          disabled={!optimizationComplete}
          style={{marginRight:"15px"}}
        >
          Export to DraftKings
        </button>
          )}
        {!optimizationComplete && (
          <button
            className="button-log"
            onClick={handleDownload}
          >
            Download Table
          </button>
        )}
            {!optimizationComplete && (
              <button onClick={toggleAllPlayers} className="button-log" style={{marginLeft:"15px"}}>
                {!areAllPlayersEnabled ? "Enable All Players" : "Disable All Players"}
              </button>
            )}
        </div>
        <div className="table-container">

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f2f2f2" }}>
              {/* Add table headers based on the CSV structure */}
              <th>Pos</th>
              <th>Name</th>
              <th>Team</th>
              <th>Salary</th>
              <th>Proj</th>
              <th>Value</th>
              <th>Toggle</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
                      <tr
                      key={index}
                      style={{
                        // Lower the opacity if the player is disabled
                        opacity: disabledPlayers.has(row.ID) ? 0.3 : 1,
                      }}
                    >
                {/* Fill in table data based on the CSV structure */}
                <td>{row.Position}</td>
                <td>{row.Name}</td>
                <td>{row.TeamAbbrev}</td>
                <td>{row.Salary}</td>
                <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  {editingId === row.ID ? (
    <div style={{ display: 'flex', alignItems: 'center' }}>
    <input
        type="number"
        value={editedProjection[row.ID] || row.Projection}
        onChange={(e) => handleProjectionChange(row.ID, e.target.value)}
        style={{ width: '43px', marginRight: '5px' }}
      />
      <button
      className="button-edit"
        onClick={() => {
          handleProjectionBlur(row.ID);
          setEditingId(null);
        }}
      >
        Save
      </button>
    </div>
  ) : (
    <div
      onClick={() => setEditingId(row.ID)}
      style={{ cursor: 'pointer' }}
    >
      {row.Projection}
      <span style={{ marginLeft: '5px', color: 'grey' }}>
        (edit)
      </span>
    </div>
  )}
</td>
            
              <td>{row.Value}</td>
                <td>
                <input
                    type="checkbox"
                    checked={!disabledPlayers.has(row.ID)}
                    onChange={() => togglePlayer(row.ID)}
                    disabled={optimizationComplete} 
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <div className="logo-container">
        <img src={logo} alt="Slam" className="header-logo" />
        <div className="header">Draftkings NFL Lineup Optimizer</div>
        <div style={{ fontSize: "12px", marginTop: "10px" }}>
          Last Update: 9/7/2023 5:13pm EST
        </div>
      </div>
      <div className="container">
        {!csvData.length && <CSVUploader onUpload={handleCSVUpload} />}
        <div
          className="header"
          style={{ display: isOptimizing ? "block" : "none" }}
        >
          Solving 🔄
        </div>
        {csvData.length > 0 && (
          <div className="button-container">
            <input
              placeholder="Enter # of Lineups"
              type="number"
              min="1"
              max="200"
              value={numLineups}
              onChange={handleNumLineupsChange}
              style={{
                display:
                  isOptimizing || optimizationComplete ? "none" : "block",
                padding: "10px",
                width: "150px",
                fontSize: "16px",
                marginRight: "10px",
              }}
            />

            <OptimizerButton onOptimize={handleOptimizeClick} />
            {/* <button id="reset" className="button"
                style={{ display: isOptimizing ? 'none' : 'block' }} onClick={handleReset}>Upload Data</button> */}
          </div>
        )}
        {optimizedLineup.length > 0 && (
          <LineupDisplay lineup={optimizedLineup} />
        )}
          {csvData.length > 0 && <Table data={csvData} optimizationComplete={optimizationComplete} />}
      </div>
    </div>
  );
}

export default App;
