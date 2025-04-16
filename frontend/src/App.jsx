import React, { useState } from 'react';
import './App.css';

function App() {
  const [source, setSource] = useState('');
  const [clickhouseConfig, setClickhouseConfig] = useState({
    host: '',
    port: '',
    user: '',
    password: '',
    database: ''
  });
  const [connectionStatus, setConnectionStatus] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [file, setFile] = useState(null);

  const handleConnect = async () => {
    const { host, port, user, database } = clickhouseConfig;
    if (!host || !port || !user || !database) {
      setConnectionStatus('Please fill all required fields.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clickhouseConfig),
      });
      const data = await res.json();
      if (data.message) {
        setConnectionStatus(data.message);
        loadTables();
      } else {
        setConnectionStatus('Connection failed');
      }
    } catch (err) {
      setConnectionStatus('Connection failed');
    }
  };

  const loadTables = async () => {
    try {
      const res = await fetch('http://localhost:5000/clickhouse/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clickhouseConfig),
      });
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err) {
      console.error('Error loading tables:', err);
    }
  };

  const loadColumns = async (table) => {
    setSelectedTable(table);
    try {
      const res = await fetch('http://localhost:5000/clickhouse/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...clickhouseConfig, table }),
      });
      const data = await res.json();
      setColumns(data.columns || []);
      setSelectedColumns([]);
      setPreviewData([]);
    } catch (err) {
      console.error('Error loading columns:', err);
    }
  };

  const toggleColumn = (columnName) => {
    setSelectedColumns((prev) =>
      prev.includes(columnName)
        ? prev.filter((col) => col !== columnName)
        : [...prev, columnName]
    );
  };

  const fetchPreview = async () => {
    if (!selectedTable || selectedColumns.length === 0) {
      alert('Please select a table and at least one column.');
      return;
    }

    const res = await fetch('http://localhost:5000/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...clickhouseConfig,
        table: selectedTable,
        columns: selectedColumns,
      }),
    });

    const data = await res.json();
    setPreviewData(data.preview || []);
  };

  const handleExport = async () => {
    if (!selectedTable || selectedColumns.length === 0) {
      alert('Select a table and at least one column to export.');
      return;
    }

    const res = await fetch('http://localhost:5000/ingest/ch-to-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...clickhouseConfig,
        query: `SELECT ${selectedColumns.join(', ')} FROM ${selectedTable}`,
        filename: 'exported_data.csv',
      }),
    });

    const data = await res.json();
    alert(data.message || 'Export failed');
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert('Please select a file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('http://localhost:5000/ingest/file-to-ch', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    alert(data.message || 'File import failed');
  };

  return (
    <div className="app">
      <h1>ClickHouse ↔ Flat File Ingestion Tool</h1>

      <label>
        <strong>Select Source:</strong>
        <select onChange={(e) => setSource(e.target.value)} value={source}>
          <option value="">-- Select --</option>
          <option value="clickhouse">ClickHouse</option>
          <option value="flatfile">Flat File</option>
        </select>
      </label>

      {source === 'clickhouse' && (
        <div className="form-section">
          <h2>ClickHouse Connection</h2>
          {['host', 'port', 'user', 'password', 'database'].map((key) => (
            <input
              key={key}
              type={key === 'password' ? 'password' : 'text'}
              placeholder={key}
              value={clickhouseConfig[key]}
              onChange={(e) =>
                setClickhouseConfig({ ...clickhouseConfig, [key]: e.target.value })
              }
            />
          ))}
          <button onClick={handleConnect}>Connect</button>
          <p><strong>Status:</strong> {connectionStatus}</p>

          {tables.length > 0 && (
            <>
              <h3>Tables</h3>
              <select onChange={(e) => loadColumns(e.target.value)} value={selectedTable}>
                <option value="">-- Select Table --</option>
                {tables.map((table) => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
            </>
          )}

          {columns.length > 0 && (
            <>
              <h3>Columns in <code>{selectedTable}</code></h3>
              <div className="checkbox-group">
                {columns.map((col) => (
                  <label key={col}>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                    />
                    {col}
                  </label>
                ))}
              </div>
              <button onClick={fetchPreview}>Preview</button>
              <button onClick={handleExport}>Export Data</button>
            </>
          )}

          {previewData.length > 0 && (
            <div>
              <h3>Preview Data (Top 100 Rows)</h3>
              <div style={{ overflowX: 'auto' }}>
                <table border="1" cellPadding="5">
                  <thead>
                    <tr>
                      {selectedColumns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((value, i) => (
                          <td key={i}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {source === 'flatfile' && (
        <div className="form-section">
          <h2>Flat File Upload</h2>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleFileUpload}>Upload File to ClickHouse</button>
        </div>
      )}
    </div>
  );
}

export default App;
