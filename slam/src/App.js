import logo from "./logo2.png";
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
  const [numLineups, setNumLineups] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("45 seconds");
  const [areAllPlayersEnabled, setAreAllPlayersEnabled] = useState(true);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [editedProjection, setEditedProjection] = useState({});
  const [boostedPlayers, setBoostedPlayers] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [enableQBStacking, setEnableQBStacking] = useState(true);
  const [enableQBStackingPro, setEnableQBStackingPro] = useState(false);
  const [enableSmartDefense, setEnableSmartDefense] = useState(true);

  const [sortCriteria, setSortCriteria] = useState({
    field: "Projection",
    direction: "desc",
  });


  useEffect(() => {
    const fetchCSV = async () => {
      try {
        const response = await fetch(
          "https://sports-test-bucket-2.s3.amazonaws.com/friday-2.csv"
        );
        if (!response.ok) {
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
          let csvContent = "QB,RB,RB,WR,WR,WR,TE,FLEX,DST\n";
        
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

        const toggleBoost = (playerID) => {
          setBoostedPlayers((prevState) => {
            const newState = new Set(prevState);
            if (newState.has(playerID)) {
              newState.delete(playerID);
            } else {
              newState.add(playerID);
            }
            return newState;
          });
        
          const newData = csvData.map((player) => {
            if (player.ID === playerID) {
              if (boostedPlayers.has(playerID)) {
                player.Projection = (parseFloat(player.Projection) - 3).toFixed(2);
              } else {
                player.Projection = (parseFloat(player.Projection) + 3).toFixed(2);
              }
              player.Value = (parseFloat(player.Projection) / (parseFloat(player.Salary) / 1000)).toFixed(2);
            }
            return player;
          });
        
          setCsvData(newData);
        };
        

  const handleCSVUpload = (data) => {
    const newPositionsMap = {
      RB: ["RB1", "RB2", "FLEX"],
      WR: ["WR1", "WR2", "WR3", "FLEX"],
      TE: ["TE", "FLEX"],
    };

    const filteredData = data.filter((player) => {
      const projection = parseFloat(player.Projection);
      if ( player.Position === "DST") {
        return projection >= 5.5;
      }
      return projection >= 7;
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

    setDisabledPlayers(new Set());
    setCsvData(updatedData);
  };

  useEffect(() => {
    const positionCounts = {};
    csvData.forEach((player) => {
      const position = player.Position;
      if (!positionCounts[position]) {
        positionCounts[position] = 0;
      }
      positionCounts[position] += 1;
    });
  }, [csvData]);

  const handlePositionChange = (newPosition) => {
    setSelectedPosition(newPosition);
  };

  const handleProjectionChange = (id, newProjection) => {
    setEditedProjection({ ...editedProjection, [id]: newProjection });
  };

  const handleProjectionBlur = (id) => {
    if (editedProjection[id]) {
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
    setEditingId(null); 
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
  
    if (value > 150) {
      value = 150;
    }
  
    let baseTimePerLineup = 7.5; // in seconds
    let numLineups = parseInt(value, 10); // convert string to integer
  
    // Calculate the total time for all lineups using the formula for the sum of an arithmetic sequence
    let totalSeconds = (numLineups / 2) * (baseTimePerLineup + (baseTimePerLineup * numLineups));
  
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;
  
    let timer = "";
  
    if (hours > 0) {
      timer += `${hours} ${hours === 1 ? 'hour' : 'hours'} `;
    }
  
    if (minutes > 0) {
      timer += `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} `;
    }
  
    if (seconds > 0 && hours === 0) { // Only show seconds if no hours are there
      timer += `${seconds} ${seconds === 1 ? 'second' : 'seconds'} `;
    }
  
    if (!timer) {
      timer = "0 seconds";
    }
  
    setNumLineups(value);
    setEstimatedTime(timer.trim());
  };
  
  
  

  const togglePlayer = (playerID) => {
    setDisabledPlayers((prevState) => {
      const newState = new Set(prevState);
      const targetPlayer = csvData.find((player) => player.ID === playerID);
      const targetPlayerKey = `${targetPlayer.Name}-${targetPlayer.TeamAbbrev}`;

      const duplicates = csvData.filter(
        (player) => `${player.Name}-${player.TeamAbbrev}` === targetPlayerKey
      );

      if (newState.has(playerID)) {
        duplicates.forEach((player) => newState.delete(player.ID));
      } else {
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
    let playerPool = csvData.filter((player) => !disabledPlayers.has(player.ID));
    let additionalConstraints = []; 
  
    if (!numLineups) {
      console.log("Number of lineups not set");
      return;
    }
  
    for (let i = 0; i < numLineups; i++) {
      let lineupNumber = i + 1;
  
      console.log("Solving Lineup #" + lineupNumber + "...");
  
      let optimizedData = optimizeLineup(
        playerPool,
        additionalConstraints,
        enableQBStacking,
        enableQBStackingPro,
        enableSmartDefense
      );
  
      if (optimizedData && isLineupComplete(optimizedData)) {
        lineups.push(optimizedData);
        const estTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        console.log(`Solved Lineup #${lineupNumber} at ${estTime} (EST)`);
  
        const newConstraint = {};
        optimizedData.forEach((player) => {
          newConstraint[player.ID] = 1;
        });
        additionalConstraints.push({
          constraint: newConstraint,
          value: optimizedData.length - 1,
        });
      } else {
        alert("Could not complete more lineups. Stopping.");
        break;
      }
    }
  
    setOptimizedLineup(lineups);
    setOptimizationComplete(true); 
  };
  

  const isLineupComplete = (lineup) => {
    if (lineup.length !== 9) return false; 

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
    ];
    const lineupPositions = lineup.map((player) => player.Position);

    for (const pos of positions) {
      if (!lineupPositions.includes(pos)) return false;
    }

    return true;
  };

  const optimizeLineup = (players, additionalConstraints, enableQBStacking, enableQBStackingPro, enableSmartDefense) => {    
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
      ints: {},
    };
  
    const idToIndexMap = {};
    const idToConstraint = {};
    const playerConstraints = {};
    const teamToPositions = {};

  
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
        [player.ID]: 1,
      };

      idToIndexMap[player.ID] = i;
  
      if (!idToConstraint[player.ID]) {
        idToConstraint[player.ID] = [];
      }
      idToConstraint[player.ID].push(i);
  
      if (!playerConstraints[player.ID]) {
        playerConstraints[player.ID] = { max: 1 };
      }
  
      model.ints[i] = 1;

      const team = player.TeamAbbrev;
      const position = player.Position;
  
      if (!teamToPositions[team]) {
        teamToPositions[team] = { QB: [], RB: [] };
      }
  
      if (position === "QB") {
        teamToPositions[team].QB.push(i);
      }
      if (position === "RB1" || position === "RB2") {
        teamToPositions[team].RB.push(i);
      }

    });
  
    additionalConstraints.forEach((constraintObj, avoidIndex) => {
      model.constraints[`AvoidLineup${avoidIndex}`] = { max: constraintObj.value };
      Object.keys(constraintObj.constraint).forEach((playerID) => {
        const modelIndices = idToConstraint[playerID];
        if (modelIndices) {
          modelIndices.forEach((modelIndex) => {
            model.variables[modelIndex][`AvoidLineup${avoidIndex}`] = constraintObj.constraint[playerID];
          });
        }
      });
    });


  if (enableQBStacking) {
    const qbToReceiversMap = {};
    players.forEach((player, i) => {
      if (player.Position === "QB") {
        qbToReceiversMap[player.ID] = [];
      }
    });

    players.forEach((player, i) => {
      if (["WR1", "WR2", "WR3", "TE"].includes(player.Position)) {
        Object.keys(qbToReceiversMap).forEach((qbId) => {
          const qb = players.find((p) => p.ID === qbId);
          if (qb && qb.TeamAbbrev === player.TeamAbbrev) {
            qbToReceiversMap[qbId].push(i);
          }
        });
      }
    });

    Object.keys(qbToReceiversMap).forEach((qbId) => {
      const qbIndex = idToIndexMap[qbId];
      const receiverIndices = qbToReceiversMap[qbId];

      receiverIndices.forEach((receiverIndex) => {
        model.constraints[`Stack${qbId}`] = { min: 0, max: 1 };
        model.variables[qbIndex][`Stack${qbId}`] = -1;
        model.variables[receiverIndex][`Stack${qbId}`] = 1;
      });
    });
  }

  if (enableQBStackingPro) {
    const qbToRBMap = {};
    players.forEach((player) => {
      if (player.Position === "QB") {
        qbToRBMap[player.TeamAbbrev] = [];
      }
    });

    players.forEach((player) => {
      if (["RB1", "RB2", "FLEX"].includes(player.Position)) {
        if (qbToRBMap[player.TeamAbbrev]) {
          qbToRBMap[player.TeamAbbrev].push(idToIndexMap[player.ID]);
        }
      }
    });

    Object.keys(qbToRBMap).forEach((qbTeam) => {
      const qbIndex = players.findIndex((player) => player.Position === "QB" && player.TeamAbbrev === qbTeam);
      if (qbIndex !== -1) {
        const rbIndices = qbToRBMap[qbTeam];
        rbIndices.forEach((rbIndex) => {
          model.constraints[`QBStackingPro${qbTeam}`] = { max: 0 };
          model.variables[qbIndex][`QBStackingPro${qbTeam}`] = 1;
          model.variables[rbIndex][`QBStackingPro${qbTeam}`] = -1;
        });
      }
    });

  }

  
  

  if (enableSmartDefense) {
    const defenseToOffensivePlayersMap = {};
    players.forEach((player) => {
      if (player.Position === "DST") {
        defenseToOffensivePlayersMap[player.TeamAbbrev] = [];
      }
    });

    players.forEach((player) => {
      if (["QB", "RB1", "RB2", "WR1", "WR2", "WR3", "TE"].includes(player.Position)) {
        const opponent = player['Game Info'].split('@')[1].slice(0, 3);
        if (defenseToOffensivePlayersMap[opponent]) {
          defenseToOffensivePlayersMap[opponent].push(idToIndexMap[player.ID]);
        }
      }
    });

    Object.keys(defenseToOffensivePlayersMap).forEach((defenseTeam) => {
      const defensiveIndex = players.findIndex((player) => player.Position === "DST" && player.TeamAbbrev === defenseTeam);
      if (defensiveIndex !== -1) {
        const offensiveIndices = defenseToOffensivePlayersMap[defenseTeam];
        offensiveIndices.forEach((offensiveIndex) => {
          model.constraints[`SmartDefense${defenseTeam}`] = { max: 0 };
          model.variables[defensiveIndex][`SmartDefense${defenseTeam}`] = 1;
          model.variables[offensiveIndex][`SmartDefense${defenseTeam}`] = -1;
        });
      }
    });
  }

  
    model.constraints = { ...model.constraints, ...playerConstraints };
    
    let result = solver.Solve(model);
  
    if (result.feasible) {
      const selectedPlayers = players.filter((player, i) => result[i] === 1);
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
    if(numLineups){
    return (
      <div>
        <button
          onClick={() => {
            if (optimizationComplete) {
              window.location.reload();
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
  }
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
  
    const flexStyle = isMobile
      ? { flex: "0 0 100%", fontSize: "12px", margin: "2px" }
      : { flex: "0 0 calc(30% - 5px)", fontSize: "16px", margin: "5px" };
  
    const containerStyle = isMobile
      ? { margin: "10px", display: "flex", flexWrap: "wrap" }
      : { margin: "10px", display: "flex", flexWrap: "wrap" };
  
    return (
      <div style={containerStyle}>
        {lineup.map((singleLineup, lineupIndex) => {
          singleLineup.sort(
            (a, b) =>
              positionsOrder.indexOf(a.Position) -
              positionsOrder.indexOf(b.Position)
          );
  
          const totalPoints = singleLineup
            .reduce((acc, player) => acc + parseFloat(player.Projection), 0)
            .toFixed(1);
  
          return (
            <div key={lineupIndex} style={{ ...flexStyle, borderRadius:"15px", padding:"5px", border: "2px solid #212529" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                <tr >
                  <th style={{ textAlign: "left" }} colSpan={4}>Lineup #{lineupIndex + 1}</th>
                  <th style={{ textAlign: "right" }}>Proj: {totalPoints}</th>
                </tr>
                  <tr style={{ backgroundColor: "#212529", color:"#fff", marginTop:"15px" }}>
                    <th>Position</th>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Proj</th>
                    <th>Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {singleLineup.map((player, index) => (
                    <tr key={index}>
                      <td>{player.Position.replace(/[1-3]/g, "")}</td>
                      <td>{player.Name}</td>
                      <td>{player.TeamAbbrev}</td> {/* Assuming TeamAbbrev is the property that holds the team abbreviation */}
                      <td>{player.Projection}</td>
                      <td>${player.Salary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

    const uniqueNames = new Set();
    filteredData = filteredData.filter((row) => {
      const uniqueKey = `${row.Name}-${row.TeamAbbrev}`;
      if (!uniqueNames.has(uniqueKey)) {
        uniqueNames.add(uniqueKey);
        return true;
      }
      return false;
    });

    const handleDownload = async () => {
      const response = await fetch(
        "https://sports-test-bucket-2.s3.amazonaws.com/friday-2.csv"
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        "https://sports-bucket-nifty.s3.amazonaws.com/friday-2.csv"
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

    const handleSortChange = (field) => {
      setSortCriteria((prev) => {
        const newDirection =
          prev.field === field && prev.direction === "desc" ? "desc" : "desc";
        return { field, direction: newDirection };
      });
    };

    return (
      <div style={{  overflowX: "auto" }}>
    <div style={{ marginBottom: "15px", display:
                  isOptimizing || optimizationComplete ? "none" : "flex" }}>
    {csvData.length > 0 && (
          <div style={{fontWeight:800}}>Enter # of Lineups (max 150):</div>
          )}
    </div>
    <div style={{ display: "flex", marginBottom: "30px" }}>
    {csvData.length > 0 && (
          <div className="button-container">
            <input
              placeholder="# of Lineups"
              type="number"
              min="1"
              max="100"
              value={numLineups}
              onChange={handleNumLineupsChange}
              style={{
                display:
                  isOptimizing || optimizationComplete ? "none" : "block",
                padding: "10px",
                width: "100px",
                fontSize: "14px",
                marginRight: "5px",
              }}
            />

            <OptimizerButton onOptimize={handleOptimizeClick} />
            {/* <button id="reset" className="button"
                style={{ display: isOptimizing ? 'none' : 'block' }} onClick={handleReset}>Upload Data</button> */}
          </div>
        )}
</div>
<div style={{ display: "flex", marginBottom: "15px" }}>
          <div style={{fontWeight:800}}>Strategies:</div>
        </div>
        <div style={{ display: "flex", textAlign:"center", marginBottom: "15px" }}>
        <label>
          QB Stacking (QB/WR or QB/TE)
            <input
              type="checkbox"
              checked={enableQBStacking}
              onChange={() => setEnableQBStacking(!enableQBStacking)}
            />
          </label>
        </div>
        {/* <div style={{ display: "flex", marginBottom: "15px" }}>
        <label>
         QB Stacking Pro (No QB/RB Stack)
            <input
              type="checkbox"
              checked={enableQBStackingPro}
              onChange={() => setEnableQBStackingPro(!enableQBStackingPro)}
            />
          </label>
        </div> */}
        <div style={{ display: "flex", textAlign:"center", marginBottom: "15px" }}>
        <label>
         Smart Defense (No Players vs DST)
            <input
              type="checkbox"
              checked={enableSmartDefense}
              onChange={() => setEnableSmartDefense(!enableSmartDefense)}
            />
          </label>
        </div>

        <div style={{ display: "flex", marginBottom: "15px" }}>
          <div style={{fontWeight:800}}>Sort:</div>
        </div>
        <div style={{ display: "flex", marginBottom: "15px" }}>
        <button
            type="button"
            className={`button-log ${
              sortCriteria.field === "Projection" ? "selected" : ""
            }`}
            onClick={() => handleSortChange("Projection")}
          >
            Projection
          </button>
          <button
            type="button"
            className={`button-log ${
              sortCriteria.field === "Salary" ? "selected" : ""
            }`}
            style={{marginLeft:"15px"}}
            onClick={() => handleSortChange("Salary")}
          >
            Salary
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
          <div style={{fontWeight:800}}>Tools:</div>
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
        {/* {!optimizationComplete && (
          <button
            className="button-log"
            onClick={handleDownload}
          >
            Download
          </button>
        )} */}
            {!optimizationComplete && (
              <button onClick={toggleAllPlayers} className="button-log" >
                {!areAllPlayersEnabled ? "Enable All Players" : "Disable All Players"}
              </button>
            )}
        </div>

        <div style={{ display: "flex", marginBottom: "15px" }}>
          <div style={{fontWeight:800}}>Positions:</div>
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

        <div className="table-container">

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#212529", color:"#fff" }}>
              {/* Add table headers based on the CSV structure */}
              <th>Pos</th>
              <th>Name</th>
              <th>Team</th>
              <th>Salary</th>
              <th>Proj<span className="tooltip">
      <i className="info-icon">[i]</i>
      <span className="tooltip-text">This is the projected points.</span>
    </span></th>
              <th>Value<span className="tooltip">
      <i className="info-icon">[i]</i>
      <span className="tooltip-text">This is the value calculated based on salary and projection.</span>
    </span></th>
              <th>Toggle <span className="tooltip">
      <i className="info-icon">[i]</i>
      <span className="tooltip-text">Toggle to enable/disable the player.</span>
    </span></th>
              <th>Boost<span className="tooltip">
      <i className="info-icon">[i]</i>
      <span className="tooltip-text">Boost the player's projection by 3 points.</span>
    </span></th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
                      <tr
                      key={index}
                      style={{
                        opacity: disabledPlayers.has(row.ID) ? 0.3 : 1,
                      }}
                    >
                <td>{row.Position}</td>
                <td>
                  {boostedPlayers.has(row.ID) && "🔥"} 
                  {row.Name}
                </td>
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
                <td>
                  <input
                    type="checkbox"
                    checked={boostedPlayers.has(row.ID)}
                    onChange={() => toggleBoost(row.ID)}
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

  function Footer() {
    return (
      <footer style={{ textAlign: 'center', marginTop: '20px',color:"white" }}>
        Made with <span role="img" aria-label="heart">❤️</span> by <a href="https://twitter.com/Needelman_" style={{color:"#6366f1",textDecoration:"none"}} target="_blank" rel="noopener noreferrer">@Needelman</a>
      </footer>
    );
  }

  return (
    <div className="App">
      <div className="logo-container">
        <img src={logo} alt="Slam" className="header-logo" />
        <div className="header">Draftkings NFL Lineup Optimizer</div>
        <div style={{ fontSize: "12px", marginTop: "10px",color:"grey" }}>
          Last Update: 9/8/2023 7:42pm EST
        </div>
      </div>
      <div className="container">
        {!csvData.length && <CSVUploader onUpload={handleCSVUpload} />}
        <div
          className="header"
          style={{ display: isOptimizing ? "block" : "none",color:"#212529" }}
        >
          Solving for <span style={{fontWeight:800}}>{numLineups}</span> Lineups 🔄<br></br>Estimated Time: <span style={{fontWeight:800}}>{estimatedTime}</span>
        </div>
        <div style={{ display: isOptimizing ? "block" : "none", fontSize: "12px", marginTop: "5px",color:"grey" }}>
        The page is frozen during the solve operation. Do not leave this page or refresh.
        </div>
        {optimizedLineup.length > 0 && (
          <LineupDisplay lineup={optimizedLineup} />
        )}
          {csvData.length > 0 && <Table data={csvData} optimizationComplete={optimizationComplete} />}
      </div>
      <Footer />

    </div>
  );
}

export default App;
